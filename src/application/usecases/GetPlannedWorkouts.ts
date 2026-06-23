import fs from 'fs'
import path from 'path'
import type { PlannedWorkout } from '@/domain/activity/types'

export function getPlannedWorkouts(): PlannedWorkout[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'planned_workouts.json')
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { planned: PlannedWorkout[] }
  return parsed.planned
}
