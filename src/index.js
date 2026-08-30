/**
 * video-bitrate-calculator
 *
 * The one piece of arithmetic behind every "how do I get this under 10 MB"
 * question:
 *
 *     size = bitrate x duration
 *
 * Everything else — resolution, codec, preset — matters only because it changes
 * what bitrate you can get away with. This module turns a target size into the
 * bitrate you should ask your encoder for, and back again.
 *
 * Zero dependencies. Pure functions. Works in Node and in the browser.
 */

import { PLATFORMS, getPlatform } from "./platforms.js";
export { PLATFORMS, PLATFORM_IDS, getPlatform } from "./platforms.js";

/** Default AAC audio bitrate, in kbps. Stereo, transparent enough for speech and most music. */
export const DEFAULT_AUDIO_KBPS = 128;

/**
 * Fraction of the target actually spent.
 *
 * Encoders hit a bitrate target on average, not exactly, so aiming at 100% of a
 * hard limit lands over it often enough to matter. 0.94 is the margin that
 * makes "under 10 MB" mean under 10 MB.
 */
export const DEFAULT_SAFETY = 0.94;

/** Below this, video stops being watchable at any resolution. */
export const MIN_VIDEO_KBPS = 100;

/**
 * Bitrate a resolution needs before it starts looking soft, in kbps.
 * Rule-of-thumb figures for H.264 at ~30 fps; H.265/AV1 need roughly half.
 * @param {number} height Frame height in pixels.
 * @returns {number}
 */
export function baseBitrateKbps(height) {
  if (height >= 2160) return 16000;
  if (height >= 1440) return 8000;
  if (height >= 1080) return 5000;
  if (height >= 720) return 2800;
  if (height >= 540) return 1800;
  if (height >= 480) return 1400;
  return 900;
}

/** How much of the base bitrate each quality level spends. */
export const QUALITY_MULTIPLIER = { high: 1.8, balanced: 1.0, small: 0.5 };

/** @typedef {"high" | "balanced" | "small"} Quality */

/**
 * The bitrate you'd pick if you had no size limit at all.
 * @param {number} height
 * @param {Quality} [quality]
 * @returns {number} kbps
 */
export function recommendedVideoKbps(height, quality = "balanced") {
  const mult = QUALITY_MULTIPLIER[quality];
  if (mult === undefined) throw new TypeError(`unknown quality: ${quality}`);
  return Math.round(baseBitrateKbps(height) * mult);
}

/**
 * @typedef {object} BitrateResult
 * @property {number} videoKbps  What to pass to the encoder as -b:v.
 * @property {number} audioKbps  What to pass as -b:a (0 when audio is dropped).
 * @property {number} totalKbps  The two combined.
 * @property {boolean} feasible  False when the target needs a bitrate below MIN_VIDEO_KBPS.
 * @property {string[]} warnings Things that will bite you, in plain English.
 */

/**
 * Work backwards from a file size to the bitrate that produces it.
 *
 *     kbps = MB x safety x 8192 / seconds - audio_kbps
 *
 * 8192 because 1 MB = 8192 kilobits (1024 x 8).
 *
 * @param {object} opts
 * @param {number} opts.targetMB    Size you must come in under.
 * @param {number} opts.durationSec Length of the clip, in seconds.
 * @param {number} [opts.audioKbps] Audio bitrate; pass 0 to strip audio.
 * @param {number} [opts.safety]    Fraction of the target to spend (0-1].
 * @returns {BitrateResult}
 */
export function bitrateForTargetSize({
  targetMB,
  durationSec,
  audioKbps = DEFAULT_AUDIO_KBPS,
  safety = DEFAULT_SAFETY,
}) {
  assertPositive("targetMB", targetMB);
  assertPositive("durationSec", durationSec);
  if (audioKbps < 0) throw new RangeError("audioKbps cannot be negative");
  if (safety <= 0 || safety > 1) throw new RangeError("safety must be in (0, 1]");

  const budgetKbps = (targetMB * safety * 8192) / durationSec;
  const rawVideoKbps = budgetKbps - audioKbps;
  const videoKbps = Math.max(Math.round(rawVideoKbps), MIN_VIDEO_KBPS);

  /** @type {string[]} */
  const warnings = [];
  const feasible = rawVideoKbps >= MIN_VIDEO_KBPS;

  if (!feasible) {
    warnings.push(
      `${targetMB} MB over ${formatDuration(durationSec)} leaves ${Math.round(rawVideoKbps)} kbps ` +
        `for video, which is below the ${MIN_VIDEO_KBPS} kbps floor. Trim the clip, drop the audio, ` +
        `or accept a bigger file.`
    );
  }
  if (audioKbps > 0 && audioKbps >= budgetKbps * 0.5) {
    warnings.push(
      `Audio is eating ${Math.round((audioKbps / budgetKbps) * 100)}% of the budget. ` +
        `Drop it (audioKbps: 0) or cut it to 64 kbps if it is speech.`
    );
  }
  if (feasible && videoKbps < 500) {
    warnings.push(
      `${videoKbps} kbps will look blocky above 480p. Downscale the video rather than ` +
        `spending the bitrate on pixels nobody can see.`
    );
  }

  return { videoKbps, audioKbps, totalKbps: videoKbps + audioKbps, feasible, warnings };
}

/**
 * Forward direction: what a given bitrate produces.
 * @param {object} opts
 * @param {number} opts.videoKbps
 * @param {number} opts.durationSec
 * @param {number} [opts.audioKbps]
 * @returns {number} Size in MB.
 */
export function estimateSizeMB({ videoKbps, durationSec, audioKbps = DEFAULT_AUDIO_KBPS }) {
  assertPositive("videoKbps", videoKbps);
  assertPositive("durationSec", durationSec);
  return ((videoKbps + audioKbps) * durationSec) / 8192;
}

/**
 * How long a clip fits, if you refuse to compromise on quality.
 * @param {object} opts
 * @param {number} opts.targetMB
 * @param {number} [opts.height]
 * @param {Quality} [opts.quality]
 * @param {number} [opts.audioKbps]
 * @param {number} [opts.safety]
 * @returns {number} Seconds.
 */
export function maxDurationSec({
  targetMB,
  height = 1080,
  quality = "balanced",
  audioKbps = DEFAULT_AUDIO_KBPS,
  safety = DEFAULT_SAFETY,
}) {
  assertPositive("targetMB", targetMB);
  const totalKbps = recommendedVideoKbps(height, quality) + audioKbps;
  return (targetMB * safety * 8192) / totalKbps;
}

/**
 * @typedef {object} Plan
 * @property {string} platform
 * @property {number} limitMB
 * @property {number} targetMB
 * @property {number} videoKbps
 * @property {number} audioKbps
 * @property {number} estimatedMB
 * @property {boolean} feasible
 * @property {boolean} alreadyFits  True when the source is already under the target.
 * @property {string[]} warnings
 * @property {string[]} ffmpegArgs
 */

/**
 * Everything you need for one platform, in one call.
 *
 * @param {string} platformId  A key of PLATFORMS, e.g. "discord".
 * @param {object} opts
 * @param {number} opts.durationSec
 * @param {number} [opts.height]        Source height, used for the downscale hint.
 * @param {number} [opts.sourceMB]      Current file size; enables the "already fits" answer.
 * @param {boolean} [opts.keepAudio]
 * @param {number} [opts.audioKbps]
 * @returns {Plan}
 */
export function planFor(platformId, { durationSec, height = 1080, sourceMB, keepAudio = true, audioKbps }) {
  const platform = getPlatform(platformId);
  if (!platform) {
    throw new Error(
      `unknown platform "${platformId}". Known: ${Object.keys(PLATFORMS).join(", ")}`
    );
  }

  const audio = keepAudio ? (audioKbps ?? DEFAULT_AUDIO_KBPS) : 0;
  const result = bitrateForTargetSize({
    targetMB: platform.targetMB,
    durationSec,
    audioKbps: audio,
  });

  const warnings = [...result.warnings];
  if (platform.maxSeconds && durationSec > platform.maxSeconds) {
    warnings.push(
      `${platform.name} also caps length at ${formatDuration(platform.maxSeconds)}, ` +
        `and this clip is ${formatDuration(durationSec)}. No bitrate fixes that — trim it.`
    );
  }

  const alreadyFits = typeof sourceMB === "number" && sourceMB <= platform.targetMB;
  if (alreadyFits) {
    warnings.unshift(
      `Already ${sourceMB} MB, under the ${platform.targetMB} MB target. Re-encoding would ` +
        `only cost you quality. Send it as-is.`
    );
  }

  const suggestedHeight = suggestHeight(result.videoKbps, height);
  if (suggestedHeight < height) {
    warnings.push(
      `At ${result.videoKbps} kbps, ${height}p has more pixels than bits. Scale to ` +
        `${suggestedHeight}p — same file size, visibly cleaner.`
    );
  }

  return {
    platform: platform.name,
    limitMB: platform.limitMB,
    targetMB: platform.targetMB,
    videoKbps: result.videoKbps,
    audioKbps: audio,
    estimatedMB: round2(estimateSizeMB({ videoKbps: result.videoKbps, durationSec, audioKbps: audio })),
    feasible: result.feasible,
    alreadyFits,
    warnings,
    ffmpegArgs: ffmpegArgs({
      videoKbps: result.videoKbps,
      audioKbps: audio,
      height: suggestedHeight < height ? suggestedHeight : undefined,
    }),
  };
}

/**
 * The resolution that bitrate can actually carry. Spending 400 kbps on 1080p
 * gives you 1080 lines of mush; the same bits at 480p look fine.
 * @param {number} videoKbps
 * @param {number} sourceHeight
 * @returns {number}
 */
export function suggestHeight(videoKbps, sourceHeight) {
  const ladder = [2160, 1440, 1080, 720, 540, 480, 360];
  for (const h of ladder) {
    if (h > sourceHeight) continue;
    // Half the "looks good" bitrate is the point where a resolution starts to
    // suffer but is still the right choice over the tier below it.
    if (videoKbps >= baseBitrateKbps(h) * 0.5) return h;
  }
  return Math.min(sourceHeight, 360);
}

/**
 * A ready-to-paste ffmpeg invocation.
 * @param {object} opts
 * @param {number} opts.videoKbps
 * @param {number} [opts.audioKbps]
 * @param {number} [opts.height]  Scale to this height; omit to keep the source size.
 * @returns {string[]}
 */
export function ffmpegArgs({ videoKbps, audioKbps = DEFAULT_AUDIO_KBPS, height }) {
  /** @type {string[]} */
  const args = ["-i", "input.mp4", "-c:v", "libx264", "-b:v", `${videoKbps}k`];
  args.push("-maxrate", `${Math.round(videoKbps * 1.45)}k`, "-bufsize", `${videoKbps * 2}k`);
  args.push("-preset", "veryfast");
  if (height) args.push("-vf", `scale=-2:${height}`);
  if (audioKbps > 0) args.push("-c:a", "aac", "-b:a", `${audioKbps}k`);
  else args.push("-an");
  args.push("-movflags", "+faststart", "output.mp4");
  return args;
}

/**
 * "1.5 min", "45s" — for humans, not for parsing.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = seconds / 60;
  return `${mins >= 10 ? Math.round(mins) : Math.round(mins * 10) / 10} min`;
}

/**
 * Accepts "90", "90s", "1:30", "2m", "1h02m03s" and returns seconds.
 * @param {string | number} input
 * @returns {number}
 */
export function parseDuration(input) {
  if (typeof input === "number") return input;
  const text = String(input).trim().toLowerCase();

  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);

  if (text.includes(":")) {
    const parts = text.split(":").map(Number);
    if (parts.some(Number.isNaN)) throw new TypeError(`cannot parse duration: ${input}`);
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const match = text.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (!match || !match.slice(1).some(Boolean)) throw new TypeError(`cannot parse duration: ${input}`);
  const [h = 0, m = 0, s = 0] = match.slice(1).map((v) => (v ? Number(v) : 0));
  return h * 3600 + m * 60 + s;
}

/**
 * @param {string} name
 * @param {number} value
 */
function assertPositive(name, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number, got ${value}`);
  }
}

/** @param {number} n */
function round2(n) {
  return Math.round(n * 100) / 100;
}
