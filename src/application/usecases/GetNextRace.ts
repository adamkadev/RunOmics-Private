import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import type { UpcomingRace } from './GetGoalsData'
import { appTodayIso } from '@/lib/calendarDate'

export async function getNextRace(today: string = appTodayIso()): Promise<UpcomingRace | null> {
  const raceYears = getUpcomingRaceYears()

  const upcoming = raceYears
    .flatMap((ry) => ry.races)
    .filter((race) => race.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return upcoming[0] ?? null
}
