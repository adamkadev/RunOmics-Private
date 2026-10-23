import { dataPath } from '../dataPath'
import { dataFs } from '../dataFs'
import type { Vo2maxNorms } from '@/domain/athlete/vo2maxNorms'

export function getVo2maxNorms(): Vo2maxNorms {
  const filePath = dataPath('vo2max_norms.json')
  if (!dataFs.existsSync(filePath)) throw new Error(`VO2max norms are missing from ${filePath}`)
  return JSON.parse(dataFs.readFileSync(filePath, 'utf-8')) as Vo2maxNorms
}
