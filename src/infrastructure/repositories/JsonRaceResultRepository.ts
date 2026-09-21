import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { OfficialRaceResult } from '@/domain/activity/raceResult'

export function getOfficialRaceResults(): OfficialRaceResult[] {
  return readJsonFile<{ results?: OfficialRaceResult[] }>(dataPath('race_results.json'), {}).results ?? []
}
