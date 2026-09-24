import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { UpcomingRace, UpcomingRaceYear } from '@/domain/goals/types'

export function getUpcomingRaceYears(): UpcomingRaceYear[] {
  const { races } = readJsonFile<{ races?: UpcomingRace[] }>(dataPath('upcoming_races.json'), {})

  const byYear = new Map<number, UpcomingRace[]>()
  for (const race of races ?? []) {
    const year = Number(race.date.slice(0, 4))
    byYear.set(year, [...(byYear.get(year) ?? []), race])
  }

  return Array.from(byYear.entries()).map(([year, races]) => ({ year, races }))
}
