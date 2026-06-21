import { getUpcomingRacesFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { UpcomingRace } from './GetGoalsData'

export async function getNextRace(): Promise<UpcomingRace | null> {
  const raceYears = await getUpcomingRacesFromFirestore()
  const today = new Date().toISOString().slice(0, 10)

  const upcoming = raceYears
    .flatMap((ry) => ry.races)
    .filter((race) => race.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return upcoming[0] ?? null
}
