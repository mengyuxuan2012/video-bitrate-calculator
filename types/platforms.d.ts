/**
 * Look a platform up, case-insensitively.
 * @param {string} id
 * @returns {Platform | undefined}
 */
export function getPlatform(id: string): Platform | undefined;
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
export const PLATFORMS: Record<string, Platform>;
/** Every platform id, for CLI help and tests. */
export const PLATFORM_IDS: string[];
export type Platform = {
    /**
     * Human-readable name.
     */
    name: string;
    /**
     * The published cap, in MB.
     */
    limitMB: number;
    /**
     * What to aim for, with margin applied.
     */
    targetMB: number;
    /**
     * Hard duration cap, where one exists.
     */
    maxSeconds?: number | undefined;
    /**
     * What the limit actually applies to.
     */
    note: string;
    /**
     * ISO date this figure was last confirmed.
     */
    checked: string;
};
//# sourceMappingURL=platforms.d.ts.map