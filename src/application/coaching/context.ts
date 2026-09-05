import { createHash } from 'crypto'
import type { Activity } from '@/domain/activity/types'
import { sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
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
}

export type CoachingUpcomingRace = Omit<UpcomingRace, 'targetSeconds'> & {
  /** Present only when this specific Garmin event has an explicit time goal. */
  targetSeconds?: number
}

export interface CoachingContext {
  schemaVersion: 1
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
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() / DAY_MS)
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function recentActivities(activities: Activity[], referenceDate: string): Activity[] {
  const reference = dayNumber(referenceDate)
  return activities
    .filter((activity) => {
      const age = reference - dayNumber(activity.date)
      return age >= 0 && age < RECENT_DAYS
    })
    .sort((a, b) => b.date.localeCompare(a.date))
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

export function buildCoachingContext(input: CoachingContextInput, referenceDate: string): CoachingContext {
  const recent = recentActivities(input.activities, referenceDate)
  const reference = dayNumber(referenceDate)
  const within = (days: number) => recent.filter((activity) => reference - dayNumber(activity.date) < days)
  const last7 = within(7)
  const garmin = input.trainingStatus

  return {
    schemaVersion: 1,
    referenceDate,
    recentActivities: recent.map((activity) => ({
      id: activity.id,
      date: activity.date.slice(0, 10),
      type: activity.type,
      distanceKm: rounded(activity.distanceKm),
      durationSeconds: activity.durationSeconds,
      paceSecPerKm: activity.paceSecPerKm === null ? null : Math.round(activity.paceSecPerKm),
      avgHeartRate: activity.avgHeartRate,
      rpe: activity.rpe,
      aerobicTrainingEffect: activity.aerTrainingEffect,
      anaerobicTrainingEffect: activity.anaTrainingEffect,
      execution: sessionExecution(activity),
    })),
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
