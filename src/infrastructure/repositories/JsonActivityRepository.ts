import fs from 'fs'
import path from 'path'
import type { Activity } from '@/domain/activity/types'

export function getAllActivities(): Activity[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'activities.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { activities: Activity[] }
  return parsed.activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}
