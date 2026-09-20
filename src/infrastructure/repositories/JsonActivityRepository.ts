import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import type { Activity } from '@/domain/activity/types'

const DEFAULT_DIR = dataPath('activities')

let cache: Activity[] | null = null

/**
 * Deliberately not `readJsonFile`: every other repository backs a section of a
 * page and degrades to an empty one, but the activity index IS the dataset.
 * Falling back to zero activities here would render a complete, confident,
 * entirely wrong app - an empty dashboard, no records, no PBs - instead of
 * failing the build that has no data to publish.
 */
function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function readActivities(dirPath: string): Activity[] {
  const { months } = readJson<{ months: string[] }>(path.join(dirPath, 'index.json'))

  return months
    .flatMap((month) => readJson<{ activities: Activity[] }>(path.join(dirPath, `${month}.json`)).activities)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getAllActivities(dirPath?: string): Activity[] {
  if (dirPath) return readActivities(dirPath)
  if (!cache) cache = readActivities(DEFAULT_DIR)
  return cache
}
