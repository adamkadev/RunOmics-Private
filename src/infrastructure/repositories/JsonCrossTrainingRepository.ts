import path from 'path'
import { dataPath } from '../dataPath'
import { dataFs, dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'
import type { CrossTrainingSession } from '@/domain/activity/crossTraining'

let cache: { generation: string; sessions: CrossTrainingSession[] } | null = null

/** Newest first; [] before the sync has written any. */
export function getCrossTrainingSessions(dirPath?: string): CrossTrainingSession[] {
  const usingDefaultDir = dirPath === undefined
  const generation = dataGeneration()
  if (usingDefaultDir && cache?.generation === generation) return cache.sessions

  const dir = dirPath ?? dataPath('cross_training')
  const files = dataFs.existsSync(dir) ? dataFs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json') : []
  // Per file, so one unreadable year costs that year only: these sessions are context, never a running number.
  const sessions = files
    .flatMap((file) => readJsonFile<{ sessions?: CrossTrainingSession[] }>(path.join(dir, file), {}).sessions ?? [])
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTimeLocal ?? '').localeCompare(a.startTimeLocal ?? ''))

  if (usingDefaultDir) cache = { generation, sessions }
  return sessions
}
