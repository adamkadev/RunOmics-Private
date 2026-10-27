/** The sync runs nightly, so three missed nights is a broken sync rather than a late one. */
export const STALE_SYNC_HOURS = 72

const HOUR_MS = 3_600_000

export function hoursSinceSync(lastSyncedAt: string, now: number): number {
  return (now - new Date(lastSyncedAt).getTime()) / HOUR_MS
}
