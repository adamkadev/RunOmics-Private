import path from 'path'
import { dataPath } from '../dataPath'
import { dataFs, dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'
import type { PlannedWorkout } from '@/domain/activity/types'

let cache: { generation: string; planned: PlannedWorkout[] } | null = null

export function getAllPlannedWorkouts(dirPath?: string): PlannedWorkout[] {
  const usingDefaultDir = dirPath === undefined
  const generation = dataGeneration()
  if (usingDefaultDir && cache?.generation === generation) return cache.planned

  const dir = dirPath ?? dataPath('planned_workouts')
  if (!dataFs.existsSync(dir)) {
    if (usingDefaultDir) cache = { generation, planned: [] }
    return []
  }

  const files = dataFs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')

  // Per file, so one half-written month costs the plan that month only.
  const planned = files
    .flatMap((file) => readJsonFile<{ planned?: PlannedWorkout[] }>(path.join(dir, file), {}).planned ?? [])
    .sort((a, b) => a.date.localeCompare(b.date))

  if (usingDefaultDir) cache = { generation, planned }
  return planned
}
