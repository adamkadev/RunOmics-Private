import type { Activity } from '@/domain/activity/types'
import type { OfficialRaceResult } from '@/domain/activity/raceResult'
import type { CoachingPlan, NumberRange } from '@/domain/coaching/types'
import type { RecoveryDay } from '@/domain/training/recovery'
import { hrBoundsOf, type HrBounds } from '@/domain/training/trimp'
import { vdotFromEffort } from '@/domain/training/vdot'
import {
  checkpointCycle,
  daysBetween,
  easyHrAtPace,
  inWindow,
  MIN_EASY_RUNS,
  mondayOf,
  ratedWindow,
  readingOn,
  referenceEasyPace,
  type CheckpointCycle,
  type DateWindow,
  type EasyRunSample,
} from '@/domain/training/cycleCheckpoint'
import { round } from '@/lib/math'
import { appTodayIso } from '@/lib/calendarDate'
import { CONTROLLED_THRESHOLD, type RepLengthClass } from '@/application/coaching/controlledThreshold'
import { controlledStep, prescriptionsByDate, readControlledSession, type ControlledSessionReading } from '@/application/coaching/autoregulation'
import { adjustedEfficiencyFactor } from './GetAnalyticsData'
import { buildTimeSeries } from './GetTrainingLoad'
import { getRecoveryHistory } from './GetLoadRecovery'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import { JsonCoachingRepository } from '@/infrastructure/repositories/JsonCoachingRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { getThresholdSamples } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'

export interface Pair<T = number> {
  previous: T | null
  current: T | null
}

export interface DatedValue {
  date: string
  value: number
}

export interface FiveKCheck {
  date: string
  seconds: number
  vdot: number
}

export interface GuidePair extends Pair<NumberRange> {
  repClass: RepLengthClass
}

/** A group is null when nothing in the athlete's history could fill it: their watch does not record it. */
export interface CycleCheckpoint {
  cycle: CheckpointCycle
  /** Plan names this stretch general preparation: it counts from a macrocycle with no race. */
  generalPreparation: boolean
  volume: { kmPerWeek: Pair; runsPerWeek: Pair } | null
  /** soFar: this cycle's reps to date, the week under way included, while the cycle runs. */
  threshold: { minutesPerWeek: Pair; guides: GuidePair[]; soFar: { minutes: number; sessions: number } | null } | null
  efficiency: Pair | null
  easyHr: (Pair & { paceSecPerKm: number | null }) | null
  fiveK: Pair<FiveKCheck> | null
  vo2max: Pair<DatedValue> | null
  thresholdPace: Pair<DatedValue> | null
  lthr: Pair<DatedValue> | null
  restingHr: Pair | null
  ctl: Pair | null
}

export interface CheckpointInputs {
  activities: Activity[]
  /** Newest first: the current plan, then the ones it replaced. */
  plans: CoachingPlan[]
  officialResults: Pick<OfficialRaceResult, 'activityId' | 'distanceMeters' | 'chipTimeSeconds'>[]
  vo2max: DatedValue[]
  threshold: { date: string; lthrBpm?: number; thresholdPaceSecPerKm?: number }[]
  restingHr: RecoveryDay[]
  hrBounds: HrBounds
}

const day = (activity: Pick<Activity, 'date'>) => activity.date.slice(0, 10)
const REP_CLASSES: RepLengthClass[] = ['long', 'medium', 'short']
const MIN_RESTING_DAYS = 7

const isEasyRun = (activity: Activity) =>
  activity.type === 'Base' && activity.distanceKm >= 3 && activity.paceSecPerKm !== null && activity.avgHeartRate !== null

interface Counted {
  window: DateWindow
  weeks: number
}

/** Whole weeks of a window from the week of the first run on: before it the watch has nothing to say, not zero. */
function countedWeeks(window: DateWindow | null, firstRun: string | null): Counted | null {
  if (!window || !firstRun) return null
  const start = mondayOf(firstRun) > window.start ? mondayOf(firstRun) : window.start
  const weeks = Math.floor((daysBetween(start, window.end) + 1) / 7)
  return weeks > 0 ? { window: { start, end: window.end }, weeks } : null
}

function perWeek(activities: Activity[], counted: Counted | null): { km: number; runs: number } | null {
  if (!counted) return null
  const inside = activities.filter((activity) => inWindow(activity.date, counted.window))
  return {
    km: round(inside.reduce((sum, activity) => sum + activity.distanceKm, 0) / counted.weeks, 1),
    runs: round(inside.length / counted.weeks, 1),
  }
}

function pairOf<T>(previous: T | null, current: T | null): Pair<T> {
  return { previous, current }
}

function thresholdGroup(
  readings: ControlledSessionReading[],
  plans: CoachingPlan[],
  cycle: CheckpointCycle,
  counted: Pair<Counted>,
): CycleCheckpoint['threshold'] {
  const prescribed = plans.some((plan) => plan.weeks.some((week) => week.workouts.some((workout) => controlledStep(workout) !== null)))
  if (!prescribed && readings.length === 0) return null
  const repSeconds = (sessions: ControlledSessionReading[]) =>
    sessions.reduce((sum, reading) => sum + reading.reps.reduce((total, rep) => total + rep.seconds, 0), 0)
  const minutes = (rated: Counted | null) =>
    rated ? Math.round(repSeconds(readings.filter((reading) => inWindow(reading.date, rated.window))) / 60 / rated.weeks) : null
  const latestGuide = (repClass: RepLengthClass, window: DateWindow) =>
    readings.filter((reading) => reading.repClass === repClass && reading.reps.length > 0 && inWindow(reading.date, window)).at(-1)?.guide ?? null
  const read = { start: cycle.current.start, end: cycle.asOf }
  const guides = REP_CLASSES
    .map((repClass) => ({ repClass, previous: latestGuide(repClass, cycle.previous), current: latestGuide(repClass, read) }))
    .filter((guide) => guide.previous !== null || guide.current !== null)
  const toDate = readings.filter((reading) => reading.reps.length > 0 && inWindow(reading.date, read))
  const soFar = cycle.complete ? null : { minutes: Math.round(repSeconds(toDate) / 60), sessions: toDate.length }
  return { minutesPerWeek: pairOf(minutes(counted.previous), minutes(counted.current)), guides, soFar }
}

function fiveKChecks(activities: Activity[], plans: CoachingPlan[], officialResults: CheckpointInputs['officialResults']): FiveKCheck[] {
  const { min, max } = CONTROLLED_THRESHOLD.fitnessCheck.distanceKm
  const byDate = prescriptionsByDate(plans)
  // A 5K is a measured course: the chip time when there is one, never the GPS distance.
  const chip = new Map(officialResults.filter((result) => result.distanceMeters === 5_000).map((result) => [result.activityId, result.chipTimeSeconds]))
  return activities
    .filter((activity) => activity.distanceKm >= min && activity.distanceKm <= max
      && (activity.type === 'Race' || (byDate.get(day(activity)) ?? []).some((workout) => workout.type === 'race')))
    .map((activity) => {
      const seconds = chip.get(activity.id) ?? activity.durationSeconds
      return { date: day(activity), seconds, vdot: round(vdotFromEffort(5, seconds), 1) }
    })
    .sort((left, right) => left.date.localeCompare(right.date))
}

function datedPair(samples: DatedValue[], cycle: CheckpointCycle): Pair<DatedValue> | null {
  if (samples.length === 0) return null
  return pairOf(readingOn(samples, cycle.previous.end), readingOn(samples, cycle.asOf))
}

function meanRestingHr(days: RecoveryDay[], window: DateWindow): number | null {
  const inside = days.filter((entry) => inWindow(entry.date, window))
  return inside.length >= MIN_RESTING_DAYS ? round(inside.reduce((sum, entry) => sum + entry.restingHr, 0) / inside.length, 1) : null
}

export function buildCycleCheckpoint(inputs: CheckpointInputs, today: string): CycleCheckpoint {
  const { activities, plans } = inputs
  const plan = plans[0] ?? null
  const cycle = checkpointCycle(plan ? (plan.macrocycleStartDate ?? plan.block.startDate) : null, today)
  const read: DateWindow = { start: cycle.current.start, end: cycle.asOf }
  const past = activities.filter((activity) => day(activity) <= today)

  const firstRun = past.reduce<string | null>((first, activity) => (first === null || day(activity) < first ? day(activity) : first), null)
  const counted = pairOf(countedWeeks(cycle.previous, firstRun), countedWeeks(ratedWindow(cycle.current, cycle.completeWeeks), firstRun))
  const previousRates = perWeek(past, counted.previous)
  const currentRates = perWeek(past, counted.current)

  const byDate = prescriptionsByDate(plans)
  const readings = past
    .flatMap((activity) => (byDate.get(day(activity)) ?? []).map((prescription) => readControlledSession(activity, prescription)))
    .filter((reading): reading is ControlledSessionReading => reading !== null)
    .sort((left, right) => left.date.localeCompare(right.date))

  const easy = past.filter(isEasyRun)
  const efficiencyOf = (window: DateWindow) => {
    const runs = easy.filter((activity) => inWindow(activity.date, window))
    return runs.length >= MIN_EASY_RUNS ? adjustedEfficiencyFactor(runs) : null
  }
  const easySamples = (window: DateWindow): EasyRunSample[] => easy
    .filter((activity) => inWindow(activity.date, window))
    .map((activity) => ({ date: day(activity), paceSecPerKm: activity.paceSecPerKm!, hr: activity.avgHeartRate!, apparentTempC: activity.weather?.apparentTempC ?? null }))
  const previousEasy = easySamples(cycle.previous)
  const currentEasy = easySamples(read)
  const easyPace = referenceEasyPace([...previousEasy, ...currentEasy])

  const checks = fiveKChecks(past, plans, inputs.officialResults)
  const latestCheck = (window: DateWindow) => checks.filter((check) => inWindow(check.date, window)).at(-1) ?? null

  const loadSeries = past.length > 0 ? buildTimeSeries(past, inputs.hrBounds) : new Map()
  const ctlOn = (date: string) => loadSeries.get(date)?.ctl ?? null

  const thresholdPaces = inputs.threshold.flatMap((sample) => sample.thresholdPaceSecPerKm !== undefined ? [{ date: sample.date, value: sample.thresholdPaceSecPerKm }] : [])
  const lthrs = inputs.threshold.flatMap((sample) => sample.lthrBpm !== undefined ? [{ date: sample.date, value: sample.lthrBpm }] : [])

  return {
    cycle,
    generalPreparation: cycle.mode === 'coach' && !plan?.targetEvent,
    volume: past.length > 0 ? {
      kmPerWeek: pairOf(previousRates?.km ?? null, currentRates?.km ?? null),
      runsPerWeek: pairOf(previousRates?.runs ?? null, currentRates?.runs ?? null),
    } : null,
    threshold: thresholdGroup(readings, plans, cycle, counted),
    efficiency: easy.length >= MIN_EASY_RUNS ? pairOf(efficiencyOf(cycle.previous), efficiencyOf(read)) : null,
    easyHr: easy.length >= MIN_EASY_RUNS ? {
      paceSecPerKm: easyPace,
      ...pairOf(easyPace === null ? null : easyHrAtPace(previousEasy, easyPace), easyPace === null ? null : easyHrAtPace(currentEasy, easyPace)),
    } : null,
    fiveK: checks.length > 0 ? pairOf(latestCheck(cycle.previous), latestCheck(read)) : null,
    vo2max: datedPair(inputs.vo2max, cycle),
    thresholdPace: datedPair(thresholdPaces, cycle),
    lthr: datedPair(lthrs, cycle),
    restingHr: inputs.restingHr.length > 0 ? pairOf(meanRestingHr(inputs.restingHr, cycle.previous), meanRestingHr(inputs.restingHr, read)) : null,
    ctl: past.length > 0 ? pairOf(ctlOn(cycle.previous.end), ctlOn(cycle.asOf)) : null,
  }
}

/** Garmin's monthly and daily VO2max together: the daily series alone starts too late for an older cycle. */
function vo2maxSamples(activities: Activity[]): DatedValue[] {
  const { months, days } = getVo2maxSamples()
  const byDate = new Map<string, number>()
  for (const sample of [...months, ...days]) byDate.set(sample.date, sample.vo2max)
  if (byDate.size === 0) {
    for (const activity of activities) if (activity.vo2maxGarmin) byDate.set(day(activity), activity.vo2maxGarmin)
  }
  return [...byDate].map(([date, value]) => ({ date, value })).sort((left, right) => left.date.localeCompare(right.date))
}

/** Garmin's threshold detections, with the athlete history's daily copy filling the days between them. */
function thresholdSamples(): CheckpointInputs['threshold'] {
  const byDate = new Map<string, CheckpointInputs['threshold'][number]>()
  for (const entry of getAthleteHistory()) byDate.set(entry.date, { date: entry.date, lthrBpm: entry.lthrBpm, thresholdPaceSecPerKm: entry.thresholdPaceSecPerKm })
  for (const sample of getThresholdSamples()) byDate.set(sample.date, sample)
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export function getCycleCheckpoint(today = appTodayIso()): CycleCheckpoint {
  const repository = new JsonCoachingRepository()
  const current = repository.getCurrentPlan()
  const activities = getAllActivities()
  const athlete = getAthleteProfile()
  return buildCycleCheckpoint({
    activities,
    plans: [...(current ? [current] : []), ...repository.getArchivedPlans()],
    officialResults: getOfficialRaceResults(),
    vo2max: vo2maxSamples(activities),
    threshold: thresholdSamples(),
    restingHr: getRecoveryHistory(),
    hrBounds: hrBoundsOf(athlete),
  }, today)
}
