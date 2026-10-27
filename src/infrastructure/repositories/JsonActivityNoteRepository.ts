import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { ActivityNote } from './FirestoreActivityNoteRepository'
import { isEmptyNote } from '@/domain/activity/activityNote'

function readNote(raw: unknown): ActivityNote | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { note, tags, hrUnreliable } = raw as Record<string, unknown>
  const read: ActivityNote = {
    note: typeof note === 'string' ? note : '',
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [],
    ...(hrUnreliable === true ? { hrUnreliable: true } : {}),
  }
  return isEmptyNote(read) ? null : read
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

/** From the nightly copy: a mark made today reaches the figures after the next sync. */
export function getHrUnreliableIds(): Set<string> {
  return new Set([...(getActivityNotesBackup() ?? [])].filter(([, note]) => note.hrUnreliable).map(([id]) => id))
}
