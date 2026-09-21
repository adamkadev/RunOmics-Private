import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { PlannedWorkout } from '@/domain/activity/types'

let cache: PlannedWorkout[] | null = null

export function getAllPlannedWorkouts(dirPath?: string): PlannedWorkout[] {
  const usingDefaultDir = dirPath === undefined
  if (usingDefaultDir && cache) return cache

  const dir = dirPath ?? dataPath('planned_workouts')
  if (!fs.existsSync(dir)) {
    if (usingDefaultDir) cache = []
    return []
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')

  // Per file, so one half-written month costs the plan that month only.
  const planned = files
    .flatMap((file) => readJsonFile<{ planned?: PlannedWorkout[] }>(path.join(dir, file), {}).planned ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))

  if (usingDefaultDir) cache = planned
  return planned
}
