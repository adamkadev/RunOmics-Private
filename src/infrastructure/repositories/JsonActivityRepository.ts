import path from 'path'
import { dataPath } from '../dataPath'
import { dataFs, dataGeneration } from '../dataFs'
import type { Activity } from '@/domain/activity/types'
import { displayTitle } from '@/domain/activity/title'
import { plausibleBestEfforts } from '@/domain/activity/bestEfforts'
import { withHrTrust } from '@/domain/activity/hrTrust'
import { getAthleteProfile } from './JsonAthleteRepository'
import { getHrUnreliableIds } from './JsonActivityNoteRepository'
import { getShoeChoices } from './JsonShoeChoiceRepository'
import { getShoeRecords } from './JsonShoeRepository'
import { withShoeChoices } from '@/domain/shoe/shoeChoice'

let cache: { generation: string; activities: Activity[] } | null = null

/** By file and blob, so a new commit rebuilds only the months it changed and the others keep their objects. */
let monthCache = new Map<string, Activity[]>()

/**
 * Not `readJsonFile`: the index IS the dataset, and an empty fallback would
 * publish a complete, confident, entirely wrong app.
 */
function readJsonOrThrow<T>(filePath: string): T {
  return dataFs.readJsonSync(filePath) as T
}

function readMonth(file: string): Activity[] {
  return readJsonOrThrow<{ activities: Activity[] }>(file).activities
    // One title everywhere the run is named: "3 × 7:00", not "3 x 7:00".
    .map((a) => (a.description ? { ...a, description: displayTitle(a.description) } : a))
    .map((a) => {
      const bestEfforts = plausibleBestEfforts(a.bestEfforts, a.durationSeconds)
      return bestEfforts === a.bestEfforts ? a : { ...a, bestEfforts }
    })
}

const newestFirst = (a: Activity, b: Activity) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

function readActivities(dirPath: string): Activity[] {
  const { months } = readJsonOrThrow<{ months: string[] }>(path.join(dirPath, 'index.json'))
  const kept = new Map<string, Activity[]>()
  const activities = months.flatMap((month) => {
    const file = path.join(dirPath, `${month}.json`)
    const sha = dataFs.blobSha(file)
    const key = sha && `${file}@${sha}`
    const read = (key && monthCache.get(key)) || readMonth(file)
    if (key) kept.set(key, read)
    return read
  })
  monthCache = kept
  return activities.sort(newestFirst)
}

export function getAllActivities(dirPath?: string): Activity[] {
  if (dirPath) return readActivities(dirPath)
  const generation = dataGeneration()
  if (cache?.generation !== generation) {
    const trust = { reliableFrom: getAthleteProfile().hrReliableFrom, unreliableIds: getHrUnreliableIds() }
    const activities = withHrTrust(readActivities(dataPath('activities')), trust)
    cache = { generation, activities: withShoeChoices(activities, getShoeChoices(), getShoeRecords()) }
  }
  return cache.activities
}
