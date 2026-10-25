import type { CheckIn } from '@/domain/wellness/checkIn'
import { getWellnessEntries } from '@/infrastructure/repositories/FirestoreWellnessRepository'

/** Sorted by date, so the copy the sync commits changes only where a morning did. Null when Firestore did not answer. */
export async function exportWellness(): Promise<{ entries: Record<string, CheckIn> } | null> {
  const { entries, available } = await getWellnessEntries()
  if (!available) return null
  return { entries: Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))) }
}
