import fs from 'fs'
import { dataPath } from '../dataPath'
import type { OfficialRaceResult } from '@/domain/activity/raceResult'

export function getOfficialRaceResults(): OfficialRaceResult[] {
  const filePath = dataPath('race_results.json')
  if (!fs.existsSync(filePath)) return []

  const raw = fs.readFileSync(filePath, 'utf-8')
  return (JSON.parse(raw) as { results?: OfficialRaceResult[] }).results ?? []
}
