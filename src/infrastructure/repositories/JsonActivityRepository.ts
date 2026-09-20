import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import type { Activity } from '@/domain/activity/types'

const DEFAULT_DIR = dataPath('activities')

let cache: Activity[] | null = null

/**
 * Not `readJsonFile`: the index IS the dataset, and an empty fallback would
 * publish a complete, confident, entirely wrong app.
 */
function readJsonOrThrow<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function readActivities(dirPath: string): Activity[] {
  const { months } = readJsonOrThrow<{ months: string[] }>(path.join(dirPath, 'index.json'))

  return months
    .flatMap((month) => readJsonOrThrow<{ activities: Activity[] }>(path.join(dirPath, `${month}.json`)).activities)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getAllActivities(dirPath?: string): Activity[] {
  if (dirPath) return readActivities(dirPath)
  if (!cache) cache = readActivities(DEFAULT_DIR)
  return cache
}
