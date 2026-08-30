import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUDIO_KBPS,
  DEFAULT_SAFETY,
  MIN_VIDEO_KBPS,
  PLATFORMS,
  baseBitrateKbps,
  bitrateForTargetSize,
  estimateSizeMB,
  ffmpegArgs,
  formatDuration,
  getPlatform,
  maxDurationSec,
  parseDuration,
  planFor,
  recommendedVideoKbps,
  suggestHeight,
} from "../src/index.js";

test("bitrateForTargetSize applies the safety margin", () => {
  // 10 MB, 60s, 128 kbps audio:
  //   10 * 0.94 * 8192 / 60 - 128 = 1155.2
  const { videoKbps } = bitrateForTargetSize({ targetMB: 10, durationSec: 60 });
  assert.equal(videoKbps, 1155);
});

test("the estimate round-trips back under the target", () => {
  for (const targetMB of [5, 8, 10, 16, 25, 50]) {
    for (const durationSec of [15, 60, 180, 600]) {
      const { videoKbps, audioKbps, feasible } = bitrateForTargetSize({ targetMB, durationSec });
      if (!feasible) continue;
      const size = estimateSizeMB({ videoKbps, durationSec, audioKbps });
      assert.ok(size <= targetMB, `${targetMB}MB/${durationSec}s produced ${size}MB`);
      assert.ok(size >= targetMB * DEFAULT_SAFETY * 0.98, `${size}MB wastes too much of ${targetMB}MB`);
    }
  }
});

test("stripping audio gives the video its bitrate back", () => {
  const withAudio = bitrateForTargetSize({ targetMB: 10, durationSec: 60 });
  const without = bitrateForTargetSize({ targetMB: 10, durationSec: 60, audioKbps: 0 });
  assert.equal(without.videoKbps - withAudio.videoKbps, DEFAULT_AUDIO_KBPS);
  assert.equal(without.audioKbps, 0);
});

test("an impossible target is reported, not silently rounded away", () => {
  const result = bitrateForTargetSize({ targetMB: 1, durationSec: 3600 });
  assert.equal(result.feasible, false);
  assert.equal(result.videoKbps, MIN_VIDEO_KBPS);
  assert.match(result.warnings.join(" "), /below the 100 kbps floor/);
});

test("audio dominating the budget raises a warning", () => {
  const result = bitrateForTargetSize({ targetMB: 2, durationSec: 120 });
  assert.match(result.warnings.join(" "), /Audio is eating/);
});

test("invalid input throws instead of producing NaN", () => {
  assert.throws(() => bitrateForTargetSize({ targetMB: 0, durationSec: 60 }), RangeError);
  assert.throws(() => bitrateForTargetSize({ targetMB: 10, durationSec: -1 }), RangeError);
  assert.throws(() => bitrateForTargetSize({ targetMB: 10, durationSec: 60, safety: 2 }), RangeError);
  assert.throws(() => estimateSizeMB({ videoKbps: NaN, durationSec: 10 }), RangeError);
});

test("baseBitrateKbps is monotonic in height", () => {
  const heights = [360, 480, 540, 720, 1080, 1440, 2160];
  for (let i = 1; i < heights.length; i++) {
    assert.ok(baseBitrateKbps(heights[i]) > baseBitrateKbps(heights[i - 1]));
  }
});

test("quality levels scale the recommended bitrate", () => {
  assert.equal(recommendedVideoKbps(1080, "balanced"), 5000);
  assert.equal(recommendedVideoKbps(1080, "high"), 9000);
  assert.equal(recommendedVideoKbps(1080, "small"), 2500);
  assert.throws(() => recommendedVideoKbps(1080, /** @type {any} */ ("ultra")), TypeError);
});

test("maxDurationSec matches the published cheat-sheet figures", () => {
  assert.equal(Math.round(maxDurationSec({ targetMB: 9, height: 1080 })), 14);
  assert.equal(Math.round(maxDurationSec({ targetMB: 9, height: 720 })), 24);
  assert.equal(Math.round(maxDurationSec({ targetMB: 15, height: 1080 })), 23);
  assert.equal(Math.round(maxDurationSec({ targetMB: 24, height: 1080 })), 36);
});

test("suggestHeight refuses to spend bitrate on invisible pixels", () => {
  assert.equal(suggestHeight(5000, 1080), 1080);
  assert.equal(suggestHeight(1500, 1080), 720);
  assert.equal(suggestHeight(800, 1080), 480);
  assert.equal(suggestHeight(400, 1080), 360);
  assert.equal(suggestHeight(5000, 720), 720, "never upscales past the source");
});

test("every platform target sits under its own limit", () => {
  for (const [id, p] of Object.entries(PLATFORMS)) {
    assert.ok(p.targetMB < p.limitMB, `${id}: target ${p.targetMB} is not under limit ${p.limitMB}`);
    assert.ok(p.checked, `${id}: missing a checked date`);
    assert.ok(p.note.length > 10, `${id}: note is not useful`);
  }
});

test("getPlatform is case-insensitive and forgiving of whitespace", () => {
  assert.equal(getPlatform("Discord")?.limitMB, 10);
  assert.equal(getPlatform("  gmail "), PLATFORMS.gmail);
  assert.equal(getPlatform("myspace"), undefined);
});

test("planFor produces a runnable ffmpeg command", () => {
  const plan = planFor("discord", { durationSec: 60, height: 1080 });
  assert.equal(plan.limitMB, 10);
  assert.ok(plan.estimatedMB <= plan.targetMB);
  assert.ok(plan.ffmpegArgs.includes("-b:v"));
  assert.ok(plan.ffmpegArgs.includes(`${plan.videoKbps}k`));
  assert.equal(plan.ffmpegArgs.at(-1), "output.mp4");
});

test("planFor says do nothing when the file already fits", () => {
  const plan = planFor("gmail", { durationSec: 30, sourceMB: 4 });
  assert.equal(plan.alreadyFits, true);
  assert.match(plan.warnings[0], /Send it as-is/);
});

test("planFor flags a duration cap no bitrate can fix", () => {
  const plan = planFor("twitter", { durationSec: 600 });
  assert.match(plan.warnings.join(" "), /caps length at/);
});

test("planFor rejects an unknown platform by name", () => {
  assert.throws(() => planFor("vine", { durationSec: 10 }), /unknown platform "vine"/);
});

test("ffmpegArgs strips audio with -an and scales only when asked", () => {
  const stripped = ffmpegArgs({ videoKbps: 800, audioKbps: 0 });
  assert.ok(stripped.includes("-an"));
  assert.ok(!stripped.includes("-c:a"));
  assert.ok(!stripped.includes("-vf"));

  const scaled = ffmpegArgs({ videoKbps: 800, height: 720 });
  assert.ok(scaled.includes("scale=-2:720"));
});

test("parseDuration accepts every shape a human types", () => {
  assert.equal(parseDuration(90), 90);
  assert.equal(parseDuration("90"), 90);
  assert.equal(parseDuration("90s"), 90);
  assert.equal(parseDuration("1:30"), 90);
  assert.equal(parseDuration("2m"), 120);
  assert.equal(parseDuration("2m30s"), 150);
  assert.equal(parseDuration("1:02:03"), 3723);
  assert.equal(parseDuration("1h2m3s"), 3723);
  assert.throws(() => parseDuration("soon"), TypeError);
});

test("formatDuration stays readable at both ends", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(90), "1.5 min");
  assert.equal(formatDuration(900), "15 min");
});
