import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getHeatmapData, type HeatmapDay } from './GetHeatmapData'
import { getWeeklyStreakData } from './GetMilestones'

export interface ConsistencyData {
  /** Every day of the last year and a week, as the heatmap reads it. */
  days: HeatmapDay[]
  streakWeeks: number
  /** The longest run of active weeks there has been. */
  bestStreakWeeks: number | null
  /** Every run's date, for the share of days over the year before (v4.17). */
  runDates: string[]
}

/** What the Consistency page draws: the rolling year, the streaks, and the history behind them. */
export function getConsistencyData(today: string): ConsistencyData {
  const streak = getWeeklyStreakData(new Date(`${today}T12:00:00`))
  return {
    days: getHeatmapData(),
    streakWeeks: streak?.currentWeeks ?? 0,
    bestStreakWeeks: streak?.longestWeeks ?? null,
    runDates: getAllActivities().map((a) => a.date),
  }
}
