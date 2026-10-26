import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { ActivityNote } from './FirestoreActivityNoteRepository'

function readNote(raw: unknown): ActivityNote | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { note, tags } = raw as Record<string, unknown>
  const read = {
    note: typeof note === 'string' ? note : '',
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [],
  }
  return read.note === '' && read.tags.length === 0 ? null : read
}

/** The nightly sync's copy of the Firestore notes; null when it has never written one. */
export function getActivityNotesBackup(): Map<string, ActivityNote> | null {
  const file = readJsonFile<{ notes?: Record<string, unknown> } | null>(dataPath('activity_notes.json'), null)
  if (!file || typeof file.notes !== 'object' || file.notes === null) return null
  const notes = new Map<string, ActivityNote>()
  for (const [activityId, raw] of Object.entries(file.notes)) {
    const note = readNote(raw)
    if (note) notes.set(activityId, note)
  }
  return notes
}
