/**
 * Upload limits, and the target you should actually aim for.
 *
 * Every `targetMB` is deliberately below `limitMB`. Aiming exactly at a limit
 * overshoots it a meaningful fraction of the time, and a file that misses by
 * 40 KB is as rejected as one that misses by 40 MB. It also absorbs the
 * MB-versus-MiB ambiguity: a service that says "25 MB" may mean 25,000,000
 * bytes or 26,214,400, and it almost never tells you which.
 *
 * These numbers move. `checked` records when each was last confirmed; treat
 * anything older than a few months as worth re-reading from the source.
 */

/**
 * @typedef {object} Platform
 * @property {string} name        Human-readable name.
 * @property {number} limitMB     The published cap, in MB.
 * @property {number} targetMB    What to aim for, with margin applied.
 * @property {number} [maxSeconds] Hard duration cap, where one exists.
 * @property {string} note        What the limit actually applies to.
 * @property {string} checked     ISO date this figure was last confirmed.
 */

/** @type {Record<string, Platform>} */
export const PLATFORMS = {
  discord: {
    name: "Discord (free)",
    limitMB: 10,
    targetMB: 9,
    note: "Per file, not per message. Nitro tiers raise it.",
    checked: "2026-02",
  },
  github: {
    name: "GitHub issue / PR",
    limitMB: 10,
    targetMB: 9,
    note: "Attachment upload in issues, PRs and comments.",
    checked: "2026-02",
  },
  whatsapp: {
    name: "WhatsApp",
    limitMB: 16,
    targetMB: 15,
    note: "Per media file. Send as a document to bypass, at full size.",
    checked: "2026-02",
  },
  outlook: {
    name: "Outlook",
    limitMB: 20,
    targetMB: 19,
    note: "Whole message. The receiving server's limit may be lower.",
    checked: "2026-02",
  },
  gmail: {
    name: "Gmail",
    limitMB: 25,
    targetMB: 24,
    note: "Attachments + body combined. Corporate mail often stops at 10.",
    checked: "2026-02",
  },
  messenger: {
    name: "Facebook Messenger",
    limitMB: 25,
    targetMB: 24,
    note: "Per video, and it re-encodes on top of whatever you send.",
    checked: "2026-02",
  },
  email: {
    name: "Email (generic)",
    limitMB: 25,
    targetMB: 24,
    note: "The common ceiling. Assume 10 MB if you know it is a corporate inbox.",
    checked: "2026-02",
  },
  twitter: {
    name: "Twitter / X",
    limitMB: 512,
    targetMB: 48,
    maxSeconds: 140,
    note: "512 MB cap, but 2:20 max length on a free account — length binds first.",
    checked: "2026-02",
  },
  reddit: {
    name: "Reddit",
    limitMB: 1024,
    targetMB: 95,
    maxSeconds: 900,
    note: "1 GB and 15 minutes. Reddit re-encodes anyway, so smaller uploads faster.",
    checked: "2026-02",
  },
  slack: {
    name: "Slack",
    limitMB: 1024,
    targetMB: 95,
    note: "1 GB per file, but free workspaces share one storage pool.",
    checked: "2026-02",
  },
  telegram: {
    name: "Telegram",
    limitMB: 2048,
    targetMB: 95,
    note: "2 GB free / 4 GB Premium. Compressing buys transfer time, not headroom.",
    checked: "2026-02",
  },
};

/** Every platform id, for CLI help and tests. */
export const PLATFORM_IDS = Object.keys(PLATFORMS);

/**
 * Look a platform up, case-insensitively.
 * @param {string} id
 * @returns {Platform | undefined}
 */
export function getPlatform(id) {
  return PLATFORMS[String(id).toLowerCase().trim()];
}
