/**
 * Bitrate a resolution needs before it starts looking soft, in kbps.
 * Rule-of-thumb figures for H.264 at ~30 fps; H.265/AV1 need roughly half.
 * @param {number} height Frame height in pixels.
 * @returns {number}
 */
export function baseBitrateKbps(height: number): number;
/** @typedef {"high" | "balanced" | "small"} Quality */
/**
 * The bitrate you'd pick if you had no size limit at all.
 * @param {number} height
 * @param {Quality} [quality]
 * @returns {number} kbps
 */
export function recommendedVideoKbps(height: number, quality?: Quality): number;
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
export function bitrateForTargetSize({ targetMB, durationSec, audioKbps, safety, }: {
    targetMB: number;
    durationSec: number;
    audioKbps?: number | undefined;
    safety?: number | undefined;
}): BitrateResult;
/**
 * Forward direction: what a given bitrate produces.
 * @param {object} opts
 * @param {number} opts.videoKbps
 * @param {number} opts.durationSec
 * @param {number} [opts.audioKbps]
 * @returns {number} Size in MB.
 */
export function estimateSizeMB({ videoKbps, durationSec, audioKbps }: {
    videoKbps: number;
    durationSec: number;
    audioKbps?: number | undefined;
}): number;
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
export function maxDurationSec({ targetMB, height, quality, audioKbps, safety, }: {
    targetMB: number;
    height?: number | undefined;
    quality?: Quality | undefined;
    audioKbps?: number | undefined;
    safety?: number | undefined;
}): number;
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
export function planFor(platformId: string, { durationSec, height, sourceMB, keepAudio, audioKbps }: {
    durationSec: number;
    height?: number | undefined;
    sourceMB?: number | undefined;
    keepAudio?: boolean | undefined;
    audioKbps?: number | undefined;
}): Plan;
/**
 * The resolution that bitrate can actually carry. Spending 400 kbps on 1080p
 * gives you 1080 lines of mush; the same bits at 480p look fine.
 * @param {number} videoKbps
 * @param {number} sourceHeight
 * @returns {number}
 */
export function suggestHeight(videoKbps: number, sourceHeight: number): number;
/**
 * A ready-to-paste ffmpeg invocation.
 * @param {object} opts
 * @param {number} opts.videoKbps
 * @param {number} [opts.audioKbps]
 * @param {number} [opts.height]  Scale to this height; omit to keep the source size.
 * @returns {string[]}
 */
export function ffmpegArgs({ videoKbps, audioKbps, height }: {
    videoKbps: number;
    audioKbps?: number | undefined;
    height?: number | undefined;
}): string[];
/**
 * "1.5 min", "45s" — for humans, not for parsing.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds: number): string;
/**
 * Accepts "90", "90s", "1:30", "2m", "1h02m03s" and returns seconds.
 * @param {string | number} input
 * @returns {number}
 */
export function parseDuration(input: string | number): number;
/** Default AAC audio bitrate, in kbps. Stereo, transparent enough for speech and most music. */
export const DEFAULT_AUDIO_KBPS: 128;
/**
 * Fraction of the target actually spent.
 *
 * Encoders hit a bitrate target on average, not exactly, so aiming at 100% of a
 * hard limit lands over it often enough to matter. 0.94 is the margin that
 * makes "under 10 MB" mean under 10 MB.
 */
export const DEFAULT_SAFETY: 0.94;
/** Below this, video stops being watchable at any resolution. */
export const MIN_VIDEO_KBPS: 100;
export namespace QUALITY_MULTIPLIER {
    let high: number;
    let balanced: number;
    let small: number;
}
export type Quality = "high" | "balanced" | "small";
export type BitrateResult = {
    /**
     * What to pass to the encoder as -b:v.
     */
    videoKbps: number;
    /**
     * What to pass as -b:a (0 when audio is dropped).
     */
    audioKbps: number;
    /**
     * The two combined.
     */
    totalKbps: number;
    /**
     * False when the target needs a bitrate below MIN_VIDEO_KBPS.
     */
    feasible: boolean;
    /**
     * Things that will bite you, in plain English.
     */
    warnings: string[];
};
export type Plan = {
    platform: string;
    limitMB: number;
    targetMB: number;
    videoKbps: number;
    audioKbps: number;
    estimatedMB: number;
    feasible: boolean;
    /**
     * True when the source is already under the target.
     */
    alreadyFits: boolean;
    warnings: string[];
    ffmpegArgs: string[];
};
export { PLATFORMS, PLATFORM_IDS, getPlatform } from "./platforms.js";
//# sourceMappingURL=index.d.ts.map