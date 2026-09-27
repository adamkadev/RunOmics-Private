import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import type { Activity } from '@/domain/activity/types'
import { displayTitle } from '@/domain/activity/title'
import { plausibleBestEfforts } from '@/domain/activity/bestEfforts'

// Keyed by directory because the workspace is resolved per call: a cache that
// outlived a change of RUNOMICS_DATA_DIR would serve the other workspace.
let cache: { dir: string; activities: Activity[] } | null = null

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
    // One title everywhere the run is named: "3 × 7:00", not "3 x 7:00".
    .map((a) => (a.description ? { ...a, description: displayTitle(a.description) } : a))
    .map((a) => {
      const bestEfforts = plausibleBestEfforts(a.bestEfforts, a.durationSeconds)
      return bestEfforts === a.bestEfforts ? a : { ...a, bestEfforts }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getAllActivities(dirPath?: string): Activity[] {
  if (dirPath) return readActivities(dirPath)
  const dir = dataPath('activities')
  if (cache?.dir !== dir) cache = { dir, activities: readActivities(dir) }
  return cache.activities
}
