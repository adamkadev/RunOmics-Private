import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import { getWeeklyStreakData } from './GetMilestones'
import { getCrossTrainingEntries } from './GetCrossTraining'

export interface ConsistencyRun {
  date: string
  distanceKm: number
  durationSeconds: number
}

export interface ConsistencyData {
  runs: ConsistencyRun[]
  /** Other training: an active day of its own, never a run toward the target or the streak. */
  others: CrossTrainingEntry[]
  /** Weeks in a row with three runs or more, as Today and the Progress hub count them. */
  streakWeeks: number
  bestStreakWeeks: number
}

export function getConsistencyData(today: string): ConsistencyData {
  const streak = getWeeklyStreakData(new Date(`${today}T12:00:00`))
  return {
    runs: getAllActivities().map((a) => ({ date: a.date.slice(0, 10), distanceKm: a.distanceKm, durationSeconds: a.durationSeconds })),
    others: getCrossTrainingEntries(),
    streakWeeks: streak?.currentWeeks ?? 0,
    bestStreakWeeks: streak?.longestWeeks ?? 0,
  }
}
