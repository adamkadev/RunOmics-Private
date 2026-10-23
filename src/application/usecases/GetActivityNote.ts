import { getActivityNote as readActivityNote, type ActivityNoteRead } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'

/** Read on the server, behind the private site's sign-in gate. */
export function getActivityNote(activityId: string): Promise<ActivityNoteRead> {
  return readActivityNote(activityId)
}
