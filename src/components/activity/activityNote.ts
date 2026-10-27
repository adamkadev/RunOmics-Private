import { isEmptyNote } from '@/domain/activity/activityNote'

export const NOTE_MAX_LENGTH = 500
export const TAG_MAX_LENGTH = 24
export const TAGS_MAX_COUNT = 10

export interface ActivityNote {
  note: string
  tags: string[]
  hrUnreliable?: true
}

export const hasNoteContent = (note: ActivityNote) => !isEmptyNote(note)

export const EMPTY_NOTE: ActivityNote = { note: '', tags: [] }
