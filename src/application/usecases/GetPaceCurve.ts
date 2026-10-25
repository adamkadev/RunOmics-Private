import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { isRunningActivity } from '@/domain/training/trainingHistory'
import { runBests, type RunBests } from '@/domain/activity/paceCurve'

/** Oldest first; empty until the runs are reprocessed with their duration bests. */
export function getPaceBests(): RunBests[] {
  return getAllActivities()
    .filter(isRunningActivity)
    .flatMap((activity) => {
      const bests = runBests(activity)
      return bests ? [bests] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
