#!/usr/bin/env node
/**
 * video-bitrate-calculator CLI
 *
 *   npx video-bitrate-calculator discord 90s
 *   npx video-bitrate-calculator gmail 3:20 --height 1080 --no-audio
 *   npx video-bitrate-calculator --size 8 --duration 45
 *   npx video-bitrate-calculator --list
 */
import {
  PLATFORMS,
  bitrateForTargetSize,
  estimateSizeMB,
  ffmpegArgs,
  formatDuration,
  maxDurationSec,
  parseDuration,
  planFor,
  suggestHeight,
} from "./index.js";

const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const GREEN = "\u001b[32m";
const RESET = "\u001b[0m";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
/** @param {string} c @param {string} s */
const paint = (c, s) => (color ? `${c}${s}${RESET}` : s);

function help() {
  console.log(`
${paint(BOLD, "video-bitrate-calculator")} — what bitrate fits your file size?

${paint(BOLD, "Usage")}
  video-bitrate-calculator <platform> <duration> [options]
  video-bitrate-calculator --size <MB> --duration <duration> [options]
  video-bitrate-calculator --list

${paint(BOLD, "Duration")}
  90        90s        1:30       2m30s       1:02:03

${paint(BOLD, "Options")}
  --size, -s <MB>      Target size instead of a platform preset
  --duration, -d <t>   Clip length
  --height <px>        Source frame height (default 1080)
  --source <MB>        Current file size, so it can tell you when to do nothing
  --no-audio           Strip audio and spend the bitrate on video
  --audio <kbps>       Audio bitrate (default 128)
  --json               Machine-readable output
  --list               Show every platform limit
  --help, -h

${paint(BOLD, "Examples")}
  ${paint(DIM, "# a 90-second clip for Discord")}
  video-bitrate-calculator discord 90s

  ${paint(DIM, "# a 3-minute screen recording for email, no voiceover")}
  video-bitrate-calculator gmail 3:00 --no-audio

  ${paint(DIM, "# an arbitrary 8 MB target")}
  video-bitrate-calculator --size 8 --duration 45
`);
}

function list() {
  console.log(`\n${paint(BOLD, "Upload limits")} ${paint(DIM, "— aim for the target, not the limit")}\n`);
  const pad = Math.max(...Object.values(PLATFORMS).map((p) => p.name.length));
  console.log(
    paint(DIM, `  ${"PLATFORM".padEnd(pad)}  ${"LIMIT".padStart(8)}  ${"TARGET".padStart(7)}  1080p max`)
  );
  for (const [id, p] of Object.entries(PLATFORMS)) {
    const secs = maxDurationSec({ targetMB: p.targetMB, height: 1080 });
    console.log(
      `  ${p.name.padEnd(pad)}  ${`${p.limitMB} MB`.padStart(8)}  ` +
        `${`${p.targetMB} MB`.padStart(7)}  ${formatDuration(secs).padStart(8)}   ${paint(DIM, id)}`
    );
  }
  console.log(`\n${paint(DIM, "  Limits move. Each entry records when it was last checked; see src/platforms.js.")}\n`);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }
    const key = arg.replace(/^--?/, "");
    const alias = { s: "size", d: "duration", h: "help" }[key] ?? key;
    if (["help", "list", "json", "no-audio"].includes(alias)) {
      flags[alias] = true;
    } else {
      flags[alias] = argv[++i];
    }
  }
  return { flags, positional };
}

function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help || (positional.length === 0 && Object.keys(flags).length === 0)) return help();
  if (flags.list) return list();

  const height = flags.height ? Number(flags.height) : 1080;
  const keepAudio = !flags["no-audio"];
  const audioKbps = flags.audio ? Number(flags.audio) : undefined;
  const sourceMB = flags.source ? Number(flags.source) : undefined;

  const durationInput = flags.duration ?? positional[1];
  if (!durationInput) {
    console.error(paint(RED, "Missing duration. Try: video-bitrate-calculator discord 90s"));
    process.exit(1);
  }
  const durationSec = parseDuration(/** @type {string} */ (durationInput));

  // Platform mode
  const platformId = positional[0];
  if (platformId && !flags.size) {
    if (!PLATFORMS[platformId.toLowerCase()]) {
      console.error(paint(RED, `Unknown platform "${platformId}".`));
      console.error(`Known: ${Object.keys(PLATFORMS).join(", ")}`);
      process.exit(1);
    }
    const plan = planFor(platformId, { durationSec, height, sourceMB, keepAudio, audioKbps });
    if (flags.json) return console.log(JSON.stringify(plan, null, 2));
    return report({
      title: `${plan.platform} · ${formatDuration(durationSec)} clip`,
      targetMB: plan.targetMB,
      limitLabel: `${plan.limitMB} MB limit`,
      videoKbps: plan.videoKbps,
      audioKbps: plan.audioKbps,
      estimatedMB: plan.estimatedMB,
      feasible: plan.feasible,
      warnings: plan.warnings,
      args: plan.ffmpegArgs,
    });
  }

  // Raw target mode
  const targetMB = Number(flags.size);
  if (!Number.isFinite(targetMB) || targetMB <= 0) {
    console.error(paint(RED, "Give a platform or a --size in MB."));
    process.exit(1);
  }
  const audio = keepAudio ? (audioKbps ?? 128) : 0;
  const result = bitrateForTargetSize({ targetMB, durationSec, audioKbps: audio });
  const scaleTo = suggestHeight(result.videoKbps, height);
  if (flags.json) {
    return console.log(
      JSON.stringify(
        {
          targetMB,
          durationSec,
          ...result,
          estimatedMB: estimateSizeMB({ videoKbps: result.videoKbps, durationSec, audioKbps: audio }),
          suggestedHeight: scaleTo,
          ffmpegArgs: ffmpegArgs({ videoKbps: result.videoKbps, audioKbps: audio, height: scaleTo < height ? scaleTo : undefined }),
        },
        null,
        2
      )
    );
  }
  report({
    title: `${targetMB} MB target · ${formatDuration(durationSec)} clip`,
    targetMB,
    limitLabel: "custom target",
    videoKbps: result.videoKbps,
    audioKbps: audio,
    estimatedMB: Math.round(estimateSizeMB({ videoKbps: result.videoKbps, durationSec, audioKbps: audio }) * 100) / 100,
    feasible: result.feasible,
    warnings: [
      ...result.warnings,
      ...(scaleTo < height
        ? [`At ${result.videoKbps} kbps, scale to ${scaleTo}p — same size, visibly cleaner.`]
        : []),
    ],
    args: ffmpegArgs({ videoKbps: result.videoKbps, audioKbps: audio, height: scaleTo < height ? scaleTo : undefined }),
  });
}

/**
 * @param {{title: string, targetMB: number, limitLabel: string, videoKbps: number,
 *   audioKbps: number, estimatedMB: number, feasible: boolean, warnings: string[],
 *   args: string[]}} r
 */
function report(r) {
  console.log(`\n${paint(BOLD, r.title)}  ${paint(DIM, r.limitLabel)}\n`);
  const status = r.feasible ? paint(GREEN, "✓") : paint(RED, "✗");
  console.log(`  ${status} video   ${paint(BOLD, `${r.videoKbps} kbps`)}`);
  console.log(`    audio   ${r.audioKbps === 0 ? "stripped" : `${r.audioKbps} kbps`}`);
  console.log(`    lands   ~${r.estimatedMB} MB  ${paint(DIM, `(target ${r.targetMB} MB)`)}`);

  if (r.warnings.length) {
    console.log("");
    for (const w of r.warnings) console.log(`  ${paint(YELLOW, "!")} ${wrap(w, 4)}`);
  }

  console.log(`\n  ${paint(DIM, "ffmpeg " + r.args.join(" "))}\n`);
}

/** @param {string} text @param {number} indent */
function wrap(text, indent) {
  const width = Math.min((process.stdout.columns || 80) - indent - 4, 92);
  const words = text.split(" ");
  const lines = [""];
  for (const word of words) {
    if ((lines[lines.length - 1] + " " + word).trim().length > width) lines.push("");
    lines[lines.length - 1] += (lines[lines.length - 1] ? " " : "") + word;
  }
  return lines.join("\n" + " ".repeat(indent));
}

main();
