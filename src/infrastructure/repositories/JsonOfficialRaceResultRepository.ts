import fs from 'fs'
import path from 'path'
import { dataPath } from '../dataPath'
import type { OfficialRaceResult } from '@/domain/race/officialRaceResult'

const DEFAULT_DIR = dataPath('official-race-results')

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

export function getOfficialRaceResults(dirPath = DEFAULT_DIR): OfficialRaceResult[] {
  const indexPath = path.join(dirPath, 'index.json')
  if (!fs.existsSync(indexPath)) return []

  const { activityIds } = readJson<{ activityIds: string[] }>(indexPath)
  return activityIds.map((activityId) =>
    readJson<OfficialRaceResult>(path.join(dirPath, `${activityId}.json`)),
  )
}

export function getOfficialRaceResultsByActivityId(
  results: OfficialRaceResult[] = getOfficialRaceResults(),
): Map<string, OfficialRaceResult> {
  return new Map(results.map((result) => [result.activityId, result]))
}
