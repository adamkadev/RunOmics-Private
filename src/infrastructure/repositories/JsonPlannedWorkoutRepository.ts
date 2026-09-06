import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
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
