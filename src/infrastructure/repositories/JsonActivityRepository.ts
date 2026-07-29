import fs from 'fs'
import path from 'path'
import type { Activity } from '@/domain/activity/types'

// The monthly activity files total several MB of JSON; cache the parsed result
// per server process instead of re-reading/re-parsing on every call.
let cache: Activity[] | null = null

export function getAllActivities(): Activity[] {
  if (cache) return cache

  const dirPath = path.join(process.cwd(), 'public', 'data', 'activities')
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json') && f !== 'index.json')

  const activities = files.flatMap((file) => {
    const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8')
    const parsed = JSON.parse(raw) as { activities: Activity[] }
    return parsed.activities
  })

  cache = activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return cache
}
