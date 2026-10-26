import { buildCoachingContext, type CoachingContext } from './context'
import type { CoachingPlan } from '@/domain/coaching/types'
import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile, type AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { getCrossTrainingSessions } from '@/infrastructure/repositories/JsonCrossTrainingRepository'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getActivityNotes, type ActivityNote } from '@/infrastructure/repositories/FirestoreActivityNoteRepository'
import { getActivityNotesBackup } from '@/infrastructure/repositories/JsonActivityNoteRepository'
import { getWellnessEntries } from '@/infrastructure/repositories/FirestoreWellnessRepository'
import { getWellnessBackup } from '@/infrastructure/repositories/JsonWellnessRepository'
import type { CheckIn } from '@/domain/wellness/checkIn'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getThresholdSamples } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import { getVO2maxHistory } from '@/application/usecases/GetVO2maxHistory'
import { getRecords, type RecordEntry } from '@/application/usecases/GetRecords'
import { buildTimeSeries } from '@/application/usecases/GetTrainingLoad'
import { DEFAULT_HR_BOUNDS } from '@/domain/training/trimp'
import { ctlTrajectory, metricTrajectory, type Trajectories } from '@/domain/training/trajectories'

function buildTrajectories(
  activities: Activity[],
  referenceDate: string,
  records: RecordEntry[],
  athlete: AthleteProfile,
): Trajectories {
  // The athlete's own HR bounds, so this CTL matches the context's load.ctl.
  const loadSeries = buildTimeSeries(activities, {
    maxHr: athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  })
  const kmByDate = new Map<string, number>()
  for (const activity of activities) {
    kmByDate.set(activity.date, (kmByDate.get(activity.date) ?? 0) + (activity.distanceKm ?? 0))
  }

  const predictions = getGarminRacePredictions()
  return {
    thresholdPaceSecPerKm: metricTrajectory(
      getThresholdSamples()
        .filter((sample) => sample.thresholdPaceSecPerKm !== undefined)
        .map((sample) => ({ date: sample.date, value: sample.thresholdPaceSecPerKm! })),
      referenceDate,
      true,
    ),
    vo2max: metricTrajectory(
      getVO2maxHistory('1y').map((point) => ({ date: point.date, value: point.value })),
      referenceDate,
      false,
    ),
    predicted10kPaceSecPerKm: metricTrajectory(
      (predictions?.points ?? [])
        .filter((point) => point['10k'] !== null)
        .map((point) => ({ date: point.date, value: point['10k']! })),
      referenceDate,
      true,
    ),
    ctl: ctlTrajectory(loadSeries, kmByDate, referenceDate),
    // Official bests leave out the fastest efforts, which for this athlete
    // happened inside ordinary training runs.
    bestEfforts: records
      .filter((record) => record.seconds !== null)
      .map((record) => ({
        distance: record.label,
        seconds: record.seconds!,
        date: record.date,
        official: record.official,
      })),
  }
}

/** Firestore first; the nightly backup in the data repository when it cannot answer, at worst a day old. */
async function readWellness(): Promise<ReadonlyMap<string, CheckIn> | undefined> {
  const live = await getWellnessEntries()
  if (live.available) return live.entries
  const backup = getWellnessBackup()
  console.warn(
    backup
      ? '[coaching] wellness check-ins unavailable in Firestore - using the last nightly backup (wellness.json).'
      : '[coaching] wellness check-ins unavailable - no Firestore and no backup. The plan will be built without them.'
  )
  return backup ?? undefined
}

/** Firestore first, then the nightly backup: missing notes would read as an athlete who annotates nothing. */
async function readNotes(): Promise<Map<string, ActivityNote>> {
  const live = await getActivityNotes()
  if (live.available) return live.notes
  const backup = getActivityNotesBackup()
  console.warn(
    backup
      ? '[coaching] activity notes unavailable in Firestore - using the last nightly backup (activity_notes.json).'
      : '[coaching] activity notes unavailable - no Firestore and no backup. '
        + 'The plan will be built without the notes and tags the athlete wrote.'
  )
  return backup ?? new Map()
}

export async function getCoachingContext(plan: CoachingPlan | null, referenceDate: string): Promise<CoachingContext> {
  const [trainingStatus, trainingZones, activityNotes, records, wellness] = await Promise.all([
    getTrainingStatus(),
    getTrainingZones(),
    readNotes(),
    getRecords(),
    readWellness(),
  ])
  const activities = getAllActivities()
  const athlete = getAthleteProfile()

  return buildCoachingContext({
    activityNotes,
    wellness,
    archivedPlans: new JsonCoachingRepository(process.env.RUNOMICS_DATA_DIR).getArchivedPlans(),
    activities,
    plan,
    athlete,
    trainingStatus,
    loadBalance: getLoadBalance(),
    trainingZones,
    latestVo2max: getLatestVO2max(),
    racePredictions: getGarminRacePredictions(),
    trajectories: buildTrajectories(activities, referenceDate, records, athlete),
    goals: getGoalYears(),
    personalBests: getPbYears(),
    upcomingRaces: getUpcomingRaceYears().flatMap((year) => year.races),
    officialResults: getOfficialRaceResults(),
    crossTraining: getCrossTrainingSessions(),
  }, referenceDate)
}
