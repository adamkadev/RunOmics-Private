import fs from 'node:fs'
import { dataPath } from '../dataPath'
import type { Vo2maxNorms } from '@/domain/athlete/vo2maxNorms'

export function getVo2maxNorms(): Vo2maxNorms {
  const filePath = dataPath('vo2max_norms.json')
  if (!fs.existsSync(filePath)) throw new Error(`VO2max norms are missing from ${filePath}`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Vo2maxNorms
}
