import { goalEntryDoc, raceEntryDoc } from '@/domain/goals/entries'
import { getGoalsRacesEntries } from '@/infrastructure/repositories/FirestoreGoalsRacesRepository'

export interface GoalsRacesExport {
  races: Record<string, Record<string, unknown>>
  goals: Record<string, Record<string, unknown>>
}

/** Sorted by id, so the copies the sync commits change only where an entry did. Null when Firestore did not answer. */
export async function exportGoalsRaces(): Promise<GoalsRacesExport | null> {
  const { races, goals, available } = await getGoalsRacesEntries()
  if (!available) return null
  return {
    races: Object.fromEntries([...races].sort((a, b) => a.id.localeCompare(b.id)).map((entry) => [entry.id, raceEntryDoc(entry)])),
    goals: Object.fromEntries([...goals].sort((a, b) => a.year - b.year).map((entry) => [String(entry.year), goalEntryDoc(entry)])),
  }
}
