import { getCrossTrainingSessions } from '@/infrastructure/repositories/JsonCrossTrainingRepository'
import { crossTrainingEntry, type CrossTrainingEntry } from '@/domain/activity/crossTraining'

export function getCrossTrainingEntries(): CrossTrainingEntry[] {
  return getCrossTrainingSessions().map(crossTrainingEntry)
}
