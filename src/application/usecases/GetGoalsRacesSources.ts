import type { GoalYear, UpcomingRace } from '@/domain/goals/types'
import { getWrittenGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getSyncedRaces } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'

export interface GoalsRacesSources {
  syncedRaces: UpcomingRace[]
  writtenGoals: GoalYear[]
}

/** What the editor lays its entries over: Garmin's races and the hand-written goals.json. */
export function getGoalsRacesSources(): GoalsRacesSources {
  return { syncedRaces: getSyncedRaces(), writtenGoals: getWrittenGoalYears() }
}
