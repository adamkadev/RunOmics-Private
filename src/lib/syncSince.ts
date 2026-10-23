/** Shared by Settings' sync card and Today's sync pill, so a sync started from either is resumed, not dispatched twice. */
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
    // A reload mid-sync shows idle again; the sync itself is unaffected.
  }
}

export function clearStoredSince(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to reclaim if this fails - the key can only ever hold one sync.
  }
}
