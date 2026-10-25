import { getActivityNotes, type ActivityNote } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'

/** Sorted by run id, so the copy the sync commits changes only where a note did. Null when Firestore did not answer. */
export async function exportActivityNotes(): Promise<{ notes: Record<string, ActivityNote> } | null> {
  const { notes, available } = await getActivityNotes()
  if (!available) return null
  return { notes: Object.fromEntries([...notes].sort(([a], [b]) => a.localeCompare(b))) }
}
