import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import type { UpcomingRace } from './GetGoalsData'

export async function getNextRace(): Promise<UpcomingRace | null> {
  const raceYears = getUpcomingRaceYears()
  const today = new Date().toISOString().slice(0, 10)

  const upcoming = raceYears
    .flatMap((ry) => ry.races)
    .filter((race) => race.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return upcoming[0] ?? null
}
