export const GARMIN_CONNECT_URL = 'https://connect.garmin.com/modern'

/** Only the watch's own numeric ids have a page in Garmin Connect; a demo or hand-made id has nothing at the other end. */
export function isWatchId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^\d+$/.test(id)
}
