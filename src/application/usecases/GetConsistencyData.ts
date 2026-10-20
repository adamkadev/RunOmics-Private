import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getWeeklyStreakData } from './GetMilestones'

export interface ConsistencyRun {
  date: string
  distanceKm: number
  durationSeconds: number
}

export interface ConsistencyData {
  /** Every run, for the weeks the page counts and the week a tap opens. */
  runs: ConsistencyRun[]
  /** Weeks in a row with three runs or more, as Today and the Progress hub count them. */
  streakWeeks: number
  /** The longest such run of weeks there has been. */
  bestStreakWeeks: number
}

/** What the Consistency page draws (3.1): the runs, and the weekly streak behind them. */
export function getConsistencyData(today: string): ConsistencyData {
  const streak = getWeeklyStreakData(new Date(`${today}T12:00:00`))
  return {
    runs: getAllActivities().map((a) => ({ date: a.date.slice(0, 10), distanceKm: a.distanceKm, durationSeconds: a.durationSeconds })),
    streakWeeks: streak?.currentWeeks ?? 0,
    bestStreakWeeks: streak?.longestWeeks ?? 0,
  }
}
