import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { GoalYear } from '@/domain/goals/types'
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

export function getGoalYears(): GoalYear[] {
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
