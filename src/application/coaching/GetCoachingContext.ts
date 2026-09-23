import { buildCoachingContext, type CoachingContext } from './context'
import type { CoachingPlan } from '@/domain/coaching/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getActivityNotes } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'

export async function getCoachingContext(plan: CoachingPlan | null, referenceDate: string): Promise<CoachingContext> {
  const [trainingStatus, trainingZones, activityNotes] = await Promise.all([
    getTrainingStatus(),
    getTrainingZones(),
    getActivityNotes(),
  ])

  // Silence here would be indistinguishable from an athlete who annotates
  // nothing, and a plan built without an illness tag it could have had is
  // worse than one whose author knew the tag was missing.
  if (!activityNotes.available) {
    console.warn(
      '[coaching] activity notes unavailable - no FIREBASE_PROJECT_ID, or Firestore did not answer. '
        + 'The plan will be built without the notes and tags the athlete wrote.'
    )
  }

  return buildCoachingContext({
    activityNotes: activityNotes.notes,
    activities: getAllActivities(),
    plan,
    athlete: getAthleteProfile(),
    trainingStatus,
    loadBalance: getLoadBalance(),
    trainingZones,
    latestVo2max: getLatestVO2max(),
    racePredictions: getGarminRacePredictions(),
    goals: getGoalYears(),
    personalBests: getPbYears(),
    upcomingRaces: getUpcomingRaceYears().flatMap((year) => year.races),
    officialResults: getOfficialRaceResults(),
  }, referenceDate)
}
