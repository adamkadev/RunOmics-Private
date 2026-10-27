import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { UpcomingRace, UpcomingRaceYear } from '@/domain/goals/types'
import { mergeRaces, readRaceEntry, type RaceEntry } from '@/domain/goals/entries'

/** What the sync read from Garmin's calendar, before the app's edits. */
export function getSyncedRaces(): UpcomingRace[] {
  return readJsonFile<{ races?: UpcomingRace[] }>(dataPath('upcoming_races.json'), {}).races ?? []
}

/** The nightly copy of the races edited in the app (Firestore `raceEntries`). */
export function getRaceEntriesBackup(): RaceEntry[] {
  const { races } = readJsonFile<{ races?: Record<string, unknown> }>(dataPath('race_entries.json'), {})
  if (typeof races !== 'object' || races === null) return []
  return Object.entries(races).flatMap(([id, doc]) => {
    const entry = readRaceEntry(id, doc)
    return entry ? [entry] : []
  })
}

/** Every reader's races: Plan, Today, the race page, Goals and the coach agree because they all come through here. */
export function getUpcomingRaceYears(): UpcomingRaceYear[] {
  const byYear = new Map<number, UpcomingRace[]>()
  for (const race of mergeRaces(getSyncedRaces(), getRaceEntriesBackup())) {
    const year = Number(race.date.slice(0, 4))
    byYear.set(year, [...(byYear.get(year) ?? []), race])
  }

  return Array.from(byYear.entries()).map(([year, races]) => ({ year, races }))
}
