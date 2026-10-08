import { getActivityNote as readActivityNote, type ActivityNoteRead } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'

/** One activity's note, as the activity page shows it - read on the server, behind a private site's gate. */
export function getActivityNote(activityId: string): Promise<ActivityNoteRead> {
  return readActivityNote(activityId)
}
