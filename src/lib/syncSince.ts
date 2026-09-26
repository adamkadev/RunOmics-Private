/**
 * Which sync is running: the dispatch time a resumed poll asks about. Settings'
 * sync card and Today's sync pill share it, so a sync started from either is
 * picked up by the card when Settings opens instead of dispatched twice.
 */
const STORAGE_KEY = 'runomics_sync_since'

export function readStoredSince(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredSince(since: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, since)
  } catch {
    // Worst case, a page reload mid-sync shows idle again - the sync itself
    // is unaffected, it just runs without a card watching it.
  }
}

export function clearStoredSince(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to reclaim if this fails - the key can only ever hold one sync.
  }
}
