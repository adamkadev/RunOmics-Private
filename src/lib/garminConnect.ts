/**
 * Garmin Connect, where the athlete's runs, gear and profile are set and
 * changed: the app links there and never edits them itself.
 */
export const GARMIN_CONNECT_URL = 'https://connect.garmin.com/modern'

/**
 * Whether an item came from the watch and so has a page in its app: the
 * importer carries the watch's own numeric ids. A link out is drawn only for
 * those (App Fixes, 3.0 override 1) - a demo or hand-made id has nothing at
 * the other end, and the brand then lives in the URL alone.
 */
export function isWatchId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^\d+$/.test(id)
}
