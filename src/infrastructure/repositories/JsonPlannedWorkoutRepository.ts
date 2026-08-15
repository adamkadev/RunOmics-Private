import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import type { PlannedWorkout } from '@/domain/activity/types'

// Per-year files, mirroring JsonActivityRepository.ts; cache the parsed result
// per server process instead of re-reading/re-parsing on every call. Caching
// only applies to the real (default) directory - an explicit dirPath is only
// ever passed in tests, where each call must see its own fixture directory.
let cache: PlannedWorkout[] | null = null

export function getAllPlannedWorkouts(dirPath?: string): PlannedWorkout[] {
  const usingDefaultDir = dirPath === undefined
  if (usingDefaultDir && cache) return cache

  const dir = dirPath ?? dataPath('planned_workouts')
  // Guards a fresh checkout before any sync has ever run and written the directory.
  if (!fs.existsSync(dir)) {
    if (usingDefaultDir) cache = []
    return []
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')

  const planned = files
    .flatMap((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const parsed = JSON.parse(raw) as { planned: PlannedWorkout[] }
      return parsed.planned
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  if (usingDefaultDir) cache = planned
  return planned
}
