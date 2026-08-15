import fs from 'fs'
import { dataPath } from '../dataPath'
import type { UpcomingRace, UpcomingRaceYear } from '@/application/usecases/GetGoalsData'

export function getUpcomingRaceYears(): UpcomingRaceYear[] {
  const filePath = dataPath('upcoming_races.json')
  if (!fs.existsSync(filePath)) return []

  const raw = fs.readFileSync(filePath, 'utf-8')
  const races = (JSON.parse(raw) as { races: UpcomingRace[] }).races

  const byYear = new Map<number, UpcomingRace[]>()
  for (const race of races) {
    const year = Number(race.date.slice(0, 4))
    byYear.set(year, [...(byYear.get(year) ?? []), race])
  }

  return Array.from(byYear.entries()).map(([year, races]) => ({ year, races }))
}
