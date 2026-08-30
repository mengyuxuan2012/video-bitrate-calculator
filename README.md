# video-bitrate-calculator

[![npm](https://img.shields.io/npm/v/video-bitrate-calculator?color=cb3837&logo=npm)](https://www.npmjs.com/package/video-bitrate-calculator)
[![CI](https://github.com/mengyuxuan2012/video-bitrate-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/mengyuxuan2012/video-bitrate-calculator/actions/workflows/ci.yml)
[![install size](https://img.shields.io/badge/dependencies-0-brightgreen)](https://www.npmjs.com/package/video-bitrate-calculator?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/video-bitrate-calculator)](LICENSE)

**What bitrate fits your file size?** The arithmetic behind every "how do I get this
clip under 10 MB" question, as a zero-dependency library and a CLI.

```bash
npx video-bitrate-calculator discord 90s
```

```
Discord (free) · 1.5 min clip  10 MB limit

  ✓ video   642 kbps
    audio   128 kbps
    lands   ~8.46 MB  (target 9 MB)

  ! At 642 kbps, 1080p has more pixels than bits. Scale to 360p — same file
    size, visibly cleaner.

  ffmpeg -i input.mp4 -c:v libx264 -b:v 642k -maxrate 931k -bufsize 1284k \
    -preset veryfast -vf scale=-2:360 -c:a aac -b:a 128k -movflags +faststart output.mp4
```

---

## The whole idea

```
size = bitrate × duration
```

That is it. Resolution, codec and preset matter only because they change what bitrate
you can get away with. So if you know the size you need and the length of the clip,
the bitrate is not a guess — it's division:

```
video_kbps = target_MB × 0.94 × 8192 / seconds − audio_kbps
```

- **8192** because 1 MB = 1024 × 8 kilobits.
- **0.94** is safety margin, and it's the part people skip. Encoders hit a bitrate
  target *on average*, not exactly, so aiming at 100% of a hard limit lands over it
  often enough to matter — and a file that misses by 40 KB is as rejected as one that
  misses by 40 MB. The margin also absorbs the MB-vs-MiB ambiguity: a service that
  says "25 MB" may mean 25,000,000 bytes or 26,214,400, and it rarely tells you which.

## Install

```bash
npm install video-bitrate-calculator
```

Or don't — the CLI runs straight from npx, and the library is three files with no
dependencies.

## Library

```js
import { bitrateForTargetSize, planFor, maxDurationSec } from "video-bitrate-calculator";

// "I need this 90-second clip under 8 MB."
bitrateForTargetSize({ targetMB: 8, durationSec: 90 });
// → { videoKbps: 556, audioKbps: 128, totalKbps: 684, feasible: true, warnings: [] }

// "Just tell me what to do for Discord."
planFor("discord", { durationSec: 90, height: 1080 });
// → { platform: 'Discord (free)', limitMB: 10, targetMB: 9, videoKbps: 642,
//     estimatedMB: 8.46, feasible: true, alreadyFits: false,
//     warnings: [...], ffmpegArgs: ['-i', 'input.mp4', ...] }

// "How long a 1080p clip even fits in 9 MB?"
maxDurationSec({ targetMB: 9, height: 1080 }); // → 13.5 seconds
```

### API

| Function | Answers |
|---|---|
| `bitrateForTargetSize({ targetMB, durationSec, audioKbps?, safety? })` | What bitrate produces this size? |
| `estimateSizeMB({ videoKbps, durationSec, audioKbps? })` | What size does this bitrate produce? |
| `maxDurationSec({ targetMB, height?, quality? })` | How much footage fits, at watchable quality? |
| `recommendedVideoKbps(height, quality?)` | What bitrate does 1080p want, ignoring limits? |
| `suggestHeight(videoKbps, sourceHeight)` | This bitrate can carry which resolution? |
| `planFor(platformId, { durationSec, height?, sourceMB?, keepAudio? })` | Everything, for one platform. |
| `ffmpegArgs({ videoKbps, audioKbps?, height? })` | A command I can paste. |
| `parseDuration("2m30s" \| "1:30" \| 90)` | Seconds. |
| `PLATFORMS`, `getPlatform(id)` | The limits table. |

Every function is pure, throws `RangeError` on nonsense input rather than returning
`NaN`, and works unchanged in the browser.

### It tells you when you're about to waste your time

The `warnings` array is the part that took the most care. It covers the three ways
this calculation goes wrong in practice:

```js
// You are asking for something arithmetic cannot give you
bitrateForTargetSize({ targetMB: 1, durationSec: 3600 });
// → feasible: false
// → ["1 MB over 60 min leaves -126 kbps for video, which is below the 100 kbps
//    floor. Trim the clip, drop the audio, or accept a bigger file.", ...]

// You are spending the budget on the wrong track
bitrateForTargetSize({ targetMB: 6, durationSec: 200 }).warnings;
// → ["Audio is eating 55% of the budget. Drop it (audioKbps: 0) or cut it to
//    64 kbps if it is speech.",
//    "103 kbps will look blocky above 480p. Downscale the video rather than
//    spending the bitrate on pixels nobody can see."]

// You should not be compressing at all
planFor("gmail", { durationSec: 30, sourceMB: 4 }).warnings;
// → ["Already 4 MB, under the 24 MB target. Re-encoding would only cost you
//    quality. Send it as-is."]
```

That last one matters more than the rest of the library: the correct answer to
"how do I compress this" is often "you don't".

## CLI

```bash
video-bitrate-calculator <platform> <duration> [options]
video-bitrate-calculator --size <MB> --duration <duration>
video-bitrate-calculator --list
```

| Option | |
|---|---|
| `--size, -s <MB>` | Target size instead of a platform preset |
| `--duration, -d <t>` | `90` · `90s` · `1:30` · `2m30s` · `1:02:03` |
| `--height <px>` | Source frame height (default 1080) |
| `--source <MB>` | Current file size, so it can tell you when to do nothing |
| `--no-audio` | Strip audio and spend the bitrate on video |
| `--audio <kbps>` | Audio bitrate (default 128) |
| `--json` | Machine-readable output |
| `--list` | Every platform limit |

## The limits

Aim for the target, not the limit.

| Platform | Limit | Target | 1080p fits | 720p fits |
|---|---|---|---|---|
| Discord (free) | 10 MB | 9 MB | 14s | 24s |
| GitHub issue / PR | 10 MB | 9 MB | 14s | 24s |
| WhatsApp | 16 MB | 15 MB | 23s | 39s |
| Outlook | 20 MB | 19 MB | 29s | 50s |
| Gmail | 25 MB | 24 MB | 36s | 1.1 min |
| Messenger | 25 MB | 24 MB | 36s | 1.1 min |
| Twitter / X | 512 MB, 2:20 | 48 MB | 1.2 min | 2.1 min |
| Reddit | 1 GB, 15 min | 95 MB | 2.4 min | 4.2 min |
| Slack | 1 GB | 95 MB | 2.4 min | 4.2 min |
| Telegram | 2 GB | 95 MB | 2.4 min | 4.2 min |

**These numbers move.** Every entry in [`src/platforms.js`](src/platforms.js) carries a
`checked` date. If one is stale or wrong, a PR correcting it is the most useful thing
you can send.

## Things worth knowing

**Dropping audio buys you 128 kbps.** On a three-minute clip that's ~2.8 MB back —
a third of a Discord upload. Free win on screen recordings with no voiceover.

**Bitrate, not resolution, controls size.** Downscaling helps only because it lowers
the bitrate you need to look sharp. `suggestHeight()` exists because the reverse
mistake is so common: spending 400 kbps on 1080p gives you 1080 lines of mush, and
the same bits at 480p look fine.

**The receiving server's limit wins.** Corporate mail commonly stops at 10 MB, not
Gmail's 25. If a message bounces, re-compress to 10 before debugging anything else.

**H.265 and AV1 need roughly half the bitrate** for the same quality — but only help
if the other end can decode them. The `baseBitrateKbps` figures here assume H.264,
because H.264 is what plays everywhere.

## Development

```bash
npm test         # node:test, no framework
npm run types    # emit .d.ts from the JSDoc
npm run check    # both
```

19 tests, no test framework, no build step for the library itself. The round-trip test
is the important one: for every combination of target size and duration, the bitrate
this produces must yield a file *under* the target — and not wastefully under it.

## Related

Built while working on **[videocompress.dev](https://videocompress.dev)**, a video
compressor that runs entirely in the browser — the file never leaves your machine.
This library is the size math from it, extracted and made standalone.

## License

MIT
