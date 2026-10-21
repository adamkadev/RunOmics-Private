/**
 * Where the background glow setting lives (round 2, F2), apart from the
 * hooks in glow.ts so the root layout - a server component - can read them
 * for its first-paint script. `'on' | 'off'`, on by default.
 */
export const GLOW_STORAGE_KEY = 'ro-glow'
export const GLOW_ATTR = 'data-glow'
