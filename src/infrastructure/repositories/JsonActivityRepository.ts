import fs from 'fs'
import path from 'path'
import type { Activity } from '@/domain/activity/types'

export function getAllActivities(): Activity[] {
  const dirPath = path.join(process.cwd(), 'public', 'data', 'activities')
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json') && f !== 'index.json')

  const activities = files.flatMap((file) => {
    const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8')
    const parsed = JSON.parse(raw) as { activities: Activity[] }
    return parsed.activities
  })

  return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
