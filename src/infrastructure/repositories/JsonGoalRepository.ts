import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { GoalYear } from '@/domain/goals/types'
import { mergeGoals, readGoalEntry, type GoalEntry } from '@/domain/goals/entries'
import { parseTimeInput } from '@/lib/formatters'

interface RawGoalTarget {
  distance: string
  target: string | null
}

interface RawGoalYear {
  year: number
  annualDistanceKm: number
  targets: RawGoalTarget[]
}

/** The years written by hand in goals.json, before the app's edits. */
export function getWrittenGoalYears(): GoalYear[] {
  const { years } = readJsonFile<{ years?: RawGoalYear[] }>(dataPath('goals.json'), {})

  return (years ?? []).map((year) => ({
    year: year.year,
    annualDistanceKm: year.annualDistanceKm,
    targets: year.targets.map((target) => ({
      distance: target.distance,
      targetSeconds: target.target ? parseTimeInput(target.target) : null,
    })),
  }))
}

/** The nightly copy of the goals edited in the app (Firestore `goalEntries`). */
export function getGoalEntriesBackup(): GoalEntry[] {
  const { goals } = readJsonFile<{ goals?: Record<string, unknown> }>(dataPath('goal_entries.json'), {})
  if (typeof goals !== 'object' || goals === null) return []
  return Object.entries(goals).flatMap(([year, doc]) => {
    const entry = readGoalEntry(year, doc)
    return entry ? [entry] : []
  })
}

export function getGoalYears(): GoalYear[] {
  return mergeGoals(getWrittenGoalYears(), getGoalEntriesBackup())
}
