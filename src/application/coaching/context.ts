import { DAY_MS } from '@/lib/calendarDate'
import 'server-only'
import { trainingHistory, isRunningActivity, type TrainingHistory } from '@/domain/training/trainingHistory'
import { createHash } from 'crypto'
import { autoregulationReport, controlledStep, type AutoregulationReport } from './autoregulation'
import { controlledThresholdFacts, type ControlledThresholdFacts } from './controlledThreshold'
import type { Activity } from '@/domain/activity/types'
import { sessionExecution, type SessionExecution } from '@/domain/activity/sessionExecution'
import { raceExecution, type RaceExecution } from '@/domain/activity/raceExecution'
import {
  garminMeasured,
  officialResultsByActivityId,
  resolvePerformance,
  type GarminMeasured,
  type OfficialRaceResult,
  type ResolvedPerformance,
} from '@/domain/activity/raceResult'
import { COACHING_TO_ACTIVITY_TYPE, type CoachingPlan } from '@/domain/coaching/types'
import { raceDistanceMeters } from '@/domain/coaching/raceTarget'
import type { AthleteProfile, InjuryHistory, TrainingBreak } from '@/infrastructure/repositories/JsonAthleteRepository'
import { niggleEpisodes, shiftDate, type CheckIn, type NiggleEpisode } from '@/domain/wellness/checkIn'
import type { Trajectories } from '@/domain/training/trajectories'
import type { GoalYear, PbYear, UpcomingRace } from '@/application/usecases/GetGoalsData'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import { otherTrainingFacts, type CrossTrainingSession, type OtherTrainingFacts } from '@/domain/activity/crossTraining'

const RECENT_DAYS = 28
const NIGGLE_DAYS = 84
const BREAK_DAYS = 365
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
  /** Written by the athlete in the RunOmics UI. */
  note?: string
  tags?: string[]
  performance?: ResolvedPerformance
  garminMeasured?: GarminMeasured
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
  /** Strength, cycling and the rest over 28 days, outside every running figure; absent without any. */
  otherTraining?: OtherTrainingFacts
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
    ageYears: number | null
    sex: 'male' | 'female' | null
    restingHrBpm: number | null
    weightKg: number | null
    heightCm: number | null
    trainingZones: TrainingZonesData | null
    injuryHistory: InjuryHistory | null
    /** Typed into athlete.json; absent when it has none. */
    trainingBreaks?: TrainingBreak[]
  }
  /** The morning check-ins; absent when they could not be read, which is not the same as none written. */
  wellness?: {
    checkIns: ({ date: string } & CheckIn)[]
    niggles: NiggleEpisode[]
  }
  trajectories: Trajectories | null
  goals: GoalYear[]
  personalBests: PbYear[]
  upcomingRaces: CoachingUpcomingRace[]
  racePredictions: GarminRacePredictionsData['latest'] | null
  adherence: { prescribed: number; completed: number; percent: number } | null
  currentPlan: CoachingPlan | null
  /** Null without an LTHR to set a ceiling by. */
  controlledThreshold: ControlledThresholdFacts | null
  /** Proposals the athlete has not accepted; present only while the plan prescribes controlled threshold sessions. */
  autoregulation?: AutoregulationReport
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
  trajectories: Trajectories | null
  goals: GoalYear[]
  personalBests: PbYear[]
  upcomingRaces: UpcomingRace[]
  officialResults: OfficialRaceResult[]
  /** Keyed by activity id; absent entries simply have no note. */
  activityNotes?: Map<string, { note: string; tags: string[] }>
  /** The plans the current one replaced, newest first, so a session before a block boundary is still read. */
  archivedPlans?: CoachingPlan[]
  /** Keyed by local date; absent when neither Firestore nor its backup could be read. */
  wellness?: ReadonlyMap<string, CheckIn>
  crossTraining?: CrossTrainingSession[]
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

/** Omitted rather than emitted empty: a `note: ""` on every run is prompt noise. */
function annotation(note: { note: string; tags: string[] } | undefined): Partial<CompactActivity> {
  if (note === undefined) return {}
  return {
    ...(note.note === '' ? {} : { note: note.note }),
    ...(note.tags.length === 0 ? {} : { tags: note.tags }),
  }
}

function recentBreaks(breaks: TrainingBreak[] | undefined, referenceDate: string): Partial<CoachingContext['athlete']> {
  if (breaks === undefined) return {}
  const since = shiftDate(referenceDate, -BREAK_DAYS)
  return { trainingBreaks: breaks.filter((pause) => pause.end >= since && pause.start <= referenceDate) }
}

/** Ends on the reference date, so a block reproduced for an earlier day never reads a later morning. */
function wellnessFacts(entries: ReadonlyMap<string, CheckIn> | undefined, referenceDate: string): Pick<CoachingContext, 'wellness'> {
  if (entries === undefined) return {}
  const within = (days: number) => [...entries].filter(([date]) => date <= referenceDate && date > shiftDate(referenceDate, -days))
  return {
    wellness: {
      checkIns: within(RECENT_DAYS).sort(([a], [b]) => b.localeCompare(a)).map(([date, entry]) => ({ date, ...entry })),
      niggles: niggleEpisodes(new Map(within(NIGGLE_DAYS))),
    },
  }
}

function raceFacts(activity: Activity, official: OfficialRaceResult | undefined): Partial<CompactActivity> {
  if (activity.type !== 'Race') return {}
  const performance = resolvePerformance(activity, official ?? null)
  const execution = raceExecution(activity)
  return {
    performance,
    ...(performance.source === 'official' ? { garminMeasured: garminMeasured(activity) } : {}),
    ...(execution ? { raceExecution: execution } : {}),
  }
}

export function buildCoachingContext(input: CoachingContextInput, referenceDate: string): CoachingContext {
  const recent = recentActivities(input.activities.filter(isRunningActivity), referenceDate)
  const reference = dayNumber(referenceDate)
  const within = (days: number) => recent.filter((activity) => reference - dayNumber(activity.date) < days)
  const last7 = within(7)
  const garmin = input.trainingStatus
  const officialResults = officialResultsByActivityId(input.officialResults)
  const history = trainingHistory(input.activities, referenceDate)
  const otherTraining = otherTrainingFacts(input.crossTraining ?? [], referenceDate)

  return {
    schemaVersion: 1,
    referenceDate,
    trainingHistory: history,
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
      ...annotation(input.activityNotes?.get(activity.id)),
      ...raceFacts(activity, officialResults.get(activity.id)),
    })),
    volume: {
      distance7DaysKm: rounded(last7.reduce((sum, activity) => sum + activity.distanceKm, 0)),
      distance28DaysKm: rounded(recent.reduce((sum, activity) => sum + activity.distanceKm, 0)),
      runs7Days: last7.length,
      runs28Days: recent.length,
    },
    gaps: gapSummary(recent, referenceDate),
    ...(otherTraining ? { otherTraining } : {}),
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
      // maxHrBpm stays out on purpose: withholding it guards better against zones recomputed
      // as a percentage of it than instructing against that.
      ageYears: input.athlete.age ?? null,
      sex: input.athlete.sex ?? null,
      restingHrBpm: input.athlete.restingHrBpm ?? null,
      weightKg: input.athlete.weightKg ?? null,
      heightCm: input.athlete.heightCm ?? null,
      trainingZones: input.trainingZones,
      // Null means nobody has asked, which is not the same as none.
      injuryHistory: input.athlete.injuryHistory ?? null,
      ...recentBreaks(input.athlete.trainingBreaks, referenceDate),
    },
    ...wellnessFacts(input.wellness, referenceDate),
    trajectories: input.trajectories,
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
    controlledThreshold: controlledThresholdFacts(
      input.athlete.lthrBpm,
      input.trainingZones?.thresholdPaceSecPerKm ?? input.athlete.thresholdPaceSecPerKm,
      history.best4WeekAverageKm,
    ),
    ...(input.plan?.weeks.some((week) => week.workouts.some((workout) => controlledStep(workout) !== null))
      ? { autoregulation: autoregulationReport(input.activities, [input.plan, ...(input.archivedPlans ?? [])], referenceDate, input.officialResults) }
      : {}),
  }
}

export function coachingContextHash(context: CoachingContext): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 24)
}
