import { trainingHistory, isRunningActivity, type TrainingHistory } from '@/domain/training/trainingHistory'
import { createHash } from 'crypto'
import type { Activity } from '@/domain/activity/types'
import { sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { raceExecution, type RaceExecution } from '@/domain/activity/raceExecution'
import type { OfficialRaceResult } from '@/domain/race/officialRaceResult'
import { COACHING_TO_ACTIVITY_TYPE, type CoachingPlan } from '@/domain/coaching/types'
import { raceDistanceMeters } from '@/domain/coaching/raceTarget'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { GoalYear, PbYear, UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'

const DAY_MS = 86_400_000
const RECENT_DAYS = 28
const RACE_DISTANCE_TOLERANCE = 0.1

export interface CompactOfficialPerformance {
  source: 'official'
  eventName: string
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number
  gunTimeSeconds?: number
  overallPlace?: number
  provenance?: string
}

export interface CompactGarminPerformance {
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
  avgHeartRate: number | null
  rpe: number | null
  aerobicTrainingEffect: number | null
  anaerobicTrainingEffect: number | null
}

export interface CompactActivity {
  id: string
  date: string
  type: Activity['type']
  distanceKm: number
  durationSeconds: number
  paceSecPerKm: number | null
  avgHeartRate: number | null
  rpe: number | null
  aerobicTrainingEffect: number | null
  anaerobicTrainingEffect: number | null
  execution: SessionExecution
  performance?: CompactOfficialPerformance
  garmin?: CompactGarminPerformance
  raceExecution?: RaceExecution
}

export type CoachingUpcomingRace = Omit<UpcomingRace, 'targetSeconds'> & {
  targetSeconds?: number
}

export interface CoachingContext {
  schemaVersion: 1
  trainingHistory: TrainingHistory
  referenceDate: string
  recentActivities: CompactActivity[]
  volume: {
    distance7DaysKm: number
    distance28DaysKm: number
    runs7Days: number
    runs28Days: number
  }
  gaps: { daysSinceLastRun: number | null; longestGap28Days: number }
  load: {
    ctl: number | null
    atl: number | null
    tsb: number | null
    tsbNow: number | null
    acwr: number | null
    garminAcuteLoad: number | null
    garminChronicLoad: number | null
    garminLoadStatus: string | null
    balance: LoadBalanceData | null
  }
  athlete: {
    vo2max: number | null
    thresholdPaceSecPerKm: number | null
    lthrBpm: number | null
    hrZoneBoundsBpm: number[] | null
    vmaKmh: number | null
    trainingZones: TrainingZonesData | null
  }
  goals: GoalYear[]
  personalBests: PbYear[]
  upcomingRaces: CoachingUpcomingRace[]
  racePredictions: GarminRacePredictionsData['latest'] | null
  adherence: { prescribed: number; completed: number; percent: number } | null
  currentPlan: CoachingPlan | null
}

export interface CoachingContextInput {
  activities: Activity[]
  plan: CoachingPlan | null
  athlete: AthleteProfile
  trainingStatus: TrainingStatus | null
  loadBalance: LoadBalanceData | null
  trainingZones: TrainingZonesData | null
  latestVo2max: number | null
  racePredictions: GarminRacePredictionsData | null
  goals: GoalYear[]
  personalBests: PbYear[]
  upcomingRaces: UpcomingRace[]
  officialRaceResults?: OfficialRaceResult[]
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() / DAY_MS)
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function roundedTo(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function recentActivities(activities: Activity[], referenceDate: string): Activity[] {
  const reference = dayNumber(referenceDate)
  return activities
    .filter((activity) => {
      const age = reference - dayNumber(activity.date)
      return age >= 0 && age < RECENT_DAYS
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

function isCompletedRaceOnReferenceDate(
  race: UpcomingRace,
  activities: Activity[],
  referenceDate: string,
): boolean {
  if (race.date !== referenceDate) return false
  const expectedMeters = raceDistanceMeters(race.distance)
  if (expectedMeters === undefined) return false
  return activities.some((activity) => {
    if (activity.date.slice(0, 10) !== referenceDate || activity.type !== 'Race') return false
    const actualMeters = activity.distanceKm * 1_000
    return Math.abs(actualMeters - expectedMeters) / expectedMeters <= RACE_DISTANCE_TOLERANCE
  })
}

function gapSummary(activities: Activity[], referenceDate: string): CoachingContext['gaps'] {
  const days = [...new Set(activities.map((activity) => dayNumber(activity.date)))].sort((a, b) => b - a)
  const reference = dayNumber(referenceDate)
  if (days.length === 0) return { daysSinceLastRun: null, longestGap28Days: RECENT_DAYS }
  let longest = Math.max(0, reference - days[0]!)
  for (let index = 1; index < days.length; index++) longest = Math.max(longest, days[index - 1]! - days[index]! - 1)
  return { daysSinceLastRun: Math.max(0, reference - days[0]!), longestGap28Days: longest }
}

function adherence(plan: CoachingPlan | null, activities: Activity[], referenceDate: string): CoachingContext['adherence'] {
  if (!plan) return null
  const reference = dayNumber(referenceDate)
  const prescribed = plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.status !== 'cancelled')
    .filter((workout) => {
      const age = reference - dayNumber(workout.date)
      return age >= 0 && age < RECENT_DAYS
    })
  if (prescribed.length === 0) return null
  const completed = prescribed.filter((workout) =>
    activities.some((activity) =>
      activity.date.slice(0, 10) === workout.date && activity.type === COACHING_TO_ACTIVITY_TYPE[workout.type]
    )
  ).length
  return { prescribed: prescribed.length, completed, percent: Math.round((completed / prescribed.length) * 100) }
}

function compactActivity(
  activity: Activity,
  officialByActivityId: Map<string, OfficialRaceResult>,
): CompactActivity {
  const official = officialByActivityId.get(activity.id)
  const rawPace = activity.paceSecPerKm === null ? null : Math.round(activity.paceSecPerKm)
  const raw: CompactActivity = {
    id: activity.id,
    date: activity.date.slice(0, 10),
    type: activity.type,
    distanceKm: rounded(activity.distanceKm),
    durationSeconds: activity.durationSeconds,
    paceSecPerKm: rawPace,
    avgHeartRate: activity.avgHeartRate,
    rpe: activity.rpe,
    aerobicTrainingEffect: activity.aerTrainingEffect,
    anaerobicTrainingEffect: activity.anaTrainingEffect,
    execution: sessionExecution(activity),
  }

  const race = raceExecution(activity)
  if (race) raw.raceExecution = race
  if (!official) return raw

  const officialDistanceKm = official.distanceMeters / 1_000
  const officialPace = officialDistanceKm > 0
    ? roundedTo(official.chipTimeSeconds / officialDistanceKm, 1)
    : 0

  return {
    ...raw,
    distanceKm: officialDistanceKm,
    durationSeconds: official.chipTimeSeconds,
    paceSecPerKm: officialPace,
    performance: {
      source: 'official',
      eventName: official.eventName,
      distanceKm: officialDistanceKm,
      durationSeconds: official.chipTimeSeconds,
      paceSecPerKm: officialPace,
      ...(official.gunTimeSeconds === undefined ? {} : { gunTimeSeconds: official.gunTimeSeconds }),
      ...(official.overallPlace === undefined ? {} : { overallPlace: official.overallPlace }),
      ...(official.source === undefined ? {} : { provenance: official.source }),
    },
    garmin: {
      distanceKm: roundedTo(activity.distanceKm, 3),
      durationSeconds: activity.durationSeconds,
      paceSecPerKm: activity.paceSecPerKm === null ? null : roundedTo(activity.paceSecPerKm, 1),
      avgHeartRate: activity.avgHeartRate,
      rpe: activity.rpe,
      aerobicTrainingEffect: activity.aerTrainingEffect,
      anaerobicTrainingEffect: activity.anaTrainingEffect,
    },
  }
}

export function buildCoachingContext(input: CoachingContextInput, referenceDate: string): CoachingContext {
  const recent = recentActivities(input.activities.filter(isRunningActivity), referenceDate)
  const reference = dayNumber(referenceDate)
  const within = (days: number) => recent.filter((activity) => reference - dayNumber(activity.date) < days)
  const last7 = within(7)
  const garmin = input.trainingStatus
  const officialByActivityId = new Map(
    (input.officialRaceResults ?? []).map((result) => [result.activityId, result]),
  )

  return {
    schemaVersion: 1,
    referenceDate,
    trainingHistory: trainingHistory(input.activities, referenceDate),
    recentActivities: recent.map((activity) => compactActivity(activity, officialByActivityId)),
    volume: {
      distance7DaysKm: rounded(last7.reduce((sum, activity) => sum + activity.distanceKm, 0)),
      distance28DaysKm: rounded(recent.reduce((sum, activity) => sum + activity.distanceKm, 0)),
      runs7Days: last7.length,
      runs28Days: recent.length,
    },
    gaps: gapSummary(recent, referenceDate),
    load: {
      ctl: garmin?.ctl ?? null,
      atl: garmin?.atl ?? null,
      tsb: garmin?.tsb ?? null,
      tsbNow: garmin?.tsbNow ?? null,
      acwr: garmin?.acwr ?? null,
      garminAcuteLoad: garmin?.source === 'garmin' && garmin.acwr !== null && garmin.chronicLoad !== null
        ? rounded(garmin.acwr * garmin.chronicLoad)
        : null,
      garminChronicLoad: garmin?.chronicLoad ?? null,
      garminLoadStatus: garmin?.acwrStatus ?? null,
      balance: input.loadBalance,
    },
    athlete: {
      vo2max: input.latestVo2max ?? input.athlete.vo2maxMlKgMin ?? null,
      thresholdPaceSecPerKm: input.athlete.thresholdPaceSecPerKm ?? null,
      lthrBpm: input.athlete.lthrBpm ?? null,
      hrZoneBoundsBpm: input.athlete.hrZoneBoundsBpm ?? null,
      vmaKmh: input.athlete.vmaKmh ?? null,
      trainingZones: input.trainingZones,
    },
    goals: input.goals,
    personalBests: input.personalBests,
    upcomingRaces: input.upcomingRaces
      .filter((race) => race.date >= referenceDate && !isCompletedRaceOnReferenceDate(race, input.activities, referenceDate))
      .map((race) => {
        const { targetSeconds, ...rest } = race
        return targetSeconds == null ? rest : { ...rest, targetSeconds }
      })
      .sort((a, b) => a.date.localeCompare(b.date)),
    racePredictions: input.racePredictions?.latest ?? null,
    adherence: adherence(input.plan, input.activities, referenceDate),
    currentPlan: input.plan,
  }
}

export function coachingContextHash(context: CoachingContext): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 24)
}
