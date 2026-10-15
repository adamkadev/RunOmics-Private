import type { Activity } from '@/domain/activity/types'
import type { OfficialRaceResult } from '@/domain/activity/raceResult'
import type { CoachingPlan, NumberRange, WorkoutPrescription, WorkoutSegment } from '@/domain/coaching/types'
import { DAY_MS } from '@/lib/calendarDate'
import { thresholdPaceFromVdot, vdotFromEffort } from '@/domain/training/vdot'
import { CONTROLLED_THRESHOLD, repLengthClass, type RepLengthClass } from './controlledThreshold'

/**
 * Reads the athlete's own runs against the controlled threshold targets, and proposes - never
 * applies - the changes the athlete's rules call for: a pace guide moved when
 * two sessions of one repetition length agree, a lighter week when an easy run
 * says fatigue. Every threshold it judges by lives in CONTROLLED_THRESHOLD.
 */

/** A controlled threshold session's repetition: a threshold session's capped, timed and guided effort. */
export function controlledStep(workout: WorkoutPrescription): { repetitions: number; step: WorkoutSegment } | null {
  if (workout.type !== 'threshold' || workout.status === 'cancelled') return null
  for (const block of workout.blocks) {
    if (block.kind !== 'repeat') continue
    const step = block.steps.find((candidate) => candidate.kind === 'effort'
      && candidate.target.hrBpm !== undefined
      && candidate.target.durationSeconds !== undefined
      && candidate.target.paceSecPerKm !== undefined)
    if (step) return { repetitions: block.repetitions, step }
  }
  return null
}

/**
 * Every prescription by date, the newest plan's first: the current plan, then
 * the archived ones it replaced, so the session before a block boundary is
 * still found.
 */
function prescriptionsByDate(plans: CoachingPlan[]): Map<string, WorkoutPrescription[]> {
  const byDate = new Map<string, WorkoutPrescription[]>()
  const claimed = new Set<string>()
  for (const plan of plans) {
    const dates = new Set<string>()
    for (const workout of plan.weeks.flatMap((week) => week.workouts)) {
      if (workout.status === 'cancelled' || claimed.has(workout.date)) continue
      byDate.set(workout.date, [...(byDate.get(workout.date) ?? []), workout])
      dates.add(workout.date)
    }
    for (const date of dates) claimed.add(date)
  }
  return byDate
}

const isRun = (activity: Activity) => activity.sport === undefined || activity.sport === 'running'
const dayOf = (activity: Activity) => activity.date.slice(0, 10)

export interface RepReading {
  seconds: number
  paceSecPerKm: number
  /** Mean heart rate from the window start to the end of the repetition. */
  windowHr: number
  windowMaxHr: number
}

/**
 * under: every repetition well under target at the guide. over: a repetition
 * past target or touching the ceiling without having run faster than the
 * guide - easing off on a hot day still reads as over. off_guide: run away
 * from the guide, so it says nothing about the guide. unreadable: no splits
 * or heart rate to read.
 */
export type SessionVerdict = 'under' | 'over' | 'on_target' | 'off_guide' | 'unreadable'

export interface ControlledSessionReading {
  date: string
  activityId: string
  prescriptionId: string
  repClass: RepLengthClass
  guide: NumberRange
  targetHr: number
  ceilingHr: number
  tempC: number | null
  reps: RepReading[]
  verdict: SessionVerdict
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * The heart-rate samples are spread evenly over the recording, which the
 * splits' durations add up to, so a repetition's window maps onto them by
 * time. Checked against Garmin's own per-repetition average: within 1 bpm.
 */
function readReps(activity: Activity, repSeconds: number): RepReading[] {
  const samples = activity.hrSamples ?? []
  const splits = activity.splits ?? []
  const total = splits.reduce((sum, split) => sum + split.durationSec, 0) || activity.durationSeconds
  if (samples.length < 2 || splits.length === 0 || total <= 0) return []

  const index = (seconds: number) => Math.round((seconds / total) * (samples.length - 1))
  const reps: RepReading[] = []
  let elapsed = 0
  for (const split of splits) {
    const start = elapsed
    elapsed += split.durationSec
    // A fragment - a lap pressed early, a repetition abandoned - is not a repetition to read.
    if (split.type !== 'interval_active' || split.durationSec < repSeconds / 2 || split.distanceM <= 0) continue
    const from = start + Math.min(CONTROLLED_THRESHOLD.autoregulation.windowStartSeconds, split.durationSec / 2)
    // The sample at the repetition's end already belongs to the jog after it.
    const first = index(from)
    const window = samples.slice(first, Math.max(index(elapsed), first + 1)).filter((value) => value > 0)
    if (window.length === 0) continue
    reps.push({
      seconds: split.durationSec,
      paceSecPerKm: Math.round(split.durationSec / (split.distanceM / 1_000)),
      windowHr: Math.round(mean(window)),
      windowMaxHr: Math.max(...window),
    })
  }
  return reps
}

function verdictOf(reps: RepReading[], guide: NumberRange, targetHr: number): SessionVerdict {
  if (reps.length === 0) return 'unreadable'
  const { guideToleranceSecPerKm: tolerance, ceilingHrBpm: ceiling, wellUnderBpm } = CONTROLLED_THRESHOLD.autoregulation
  const fast = reps.some((rep) => rep.paceSecPerKm < guide.min - tolerance)
  const slow = reps.some((rep) => rep.paceSecPerKm > guide.max + tolerance)
  const over = reps.some((rep) => rep.windowHr > targetHr || rep.windowMaxHr >= ceiling)
  if (over) return fast ? 'off_guide' : 'over'
  if (fast || slow) return 'off_guide'
  return reps.every((rep) => rep.windowHr <= targetHr - wellUnderBpm) ? 'under' : 'on_target'
}

export function readControlledSession(activity: Activity, prescription: WorkoutPrescription): ControlledSessionReading | null {
  const controlled = controlledStep(prescription)
  if (!controlled) return null
  const { durationSeconds, paceSecPerKm } = controlled.step.target
  const repClass = repLengthClass(durationSeconds!)
  const targetHr = CONTROLLED_THRESHOLD.autoregulation.targetHrBpm[repClass]
  const reps = readReps(activity, durationSeconds!)
  return {
    date: dayOf(activity),
    activityId: activity.id,
    prescriptionId: prescription.id,
    repClass,
    guide: paceSecPerKm!,
    targetHr,
    ceilingHr: CONTROLLED_THRESHOLD.autoregulation.ceilingHrBpm,
    tempC: activity.weather?.tempC ?? null,
    reps,
    verdict: verdictOf(reps, paceSecPerKm!, targetHr),
  }
}

export interface GuideProposal {
  repClass: RepLengthClass
  direction: 'faster' | 'slower'
  guide: NumberRange
  proposedGuide: NumberRange
  stepSecPerKm: number
  sessions: Pick<ControlledSessionReading, 'date' | 'activityId' | 'verdict' | 'reps' | 'tempC'>[]
}

/**
 * Two sessions of one repetition length in a row, at the same guide, that
 * agree: both well under target, or both past it. Anything else - one of each,
 * a session run off the guide, a guide changed between them - proposes nothing.
 */
export function proposeGuideChanges(readings: ControlledSessionReading[]): GuideProposal[] {
  const { sessionsInARow, paceStepSecPerKm } = CONTROLLED_THRESHOLD.autoregulation
  const step = Math.round((paceStepSecPerKm.min + paceStepSecPerKm.max) / 2)
  const proposals: GuideProposal[] = []
  for (const repClass of ['long', 'medium', 'short'] as const) {
    const latest = readings
      .filter((reading) => reading.repClass === repClass)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-sessionsInARow)
    if (latest.length < sessionsInARow) continue
    const guide = latest[0]!.guide
    if (latest.some((reading) => reading.guide.min !== guide.min || reading.guide.max !== guide.max)) continue
    const direction = latest.every((reading) => reading.verdict === 'under') ? 'faster'
      : latest.every((reading) => reading.verdict === 'over') ? 'slower'
        : null
    if (!direction) continue
    const shift = direction === 'faster' ? -step : step
    proposals.push({
      repClass,
      direction,
      guide,
      proposedGuide: { min: guide.min + shift, max: guide.max + shift },
      stepSecPerKm: step,
      sessions: latest.map(({ date, activityId, verdict, reps, tempC }) => ({ date, activityId, verdict, reps, tempC })),
    })
  }
  return proposals
}

export interface EasyRunReading {
  activityId: string
  date: string
  hr: number
  paceSecPerKm: number
  tempC: number | null
  durationSeconds: number
}

export interface FatigueReading {
  run: EasyRunReading
  /** The median heart rate of comparable easy runs, or null with too few to say. */
  normalHr: number | null
  comparables: number
  flagged: boolean
}

const EASY_TYPES = new Set(['easy', 'recovery', 'long_run'])
const STRIDE_MAX_SECONDS = 60

/**
 * Planned easy, or - with nothing planned that day - what Garmin read as a
 * base run without repetitions in it. A watch workout records an easy run as
 * one long active step, so it is a second long one that says intervals.
 */
function easyRuns(activities: Activity[], byDate: Map<string, WorkoutPrescription[]>): EasyRunReading[] {
  return activities.filter(isRun).flatMap((activity) => {
    const planned = byDate.get(dayOf(activity))
    const efforts = (activity.splits ?? []).filter((split) => split.type === 'interval_active' && split.durationSec > STRIDE_MAX_SECONDS)
    const easy = planned ? planned.some((workout) => EASY_TYPES.has(workout.type)) : activity.type === 'Base' && efforts.length <= 1
    if (!easy || !activity.avgHeartRate || !activity.paceSecPerKm) return []
    return [{
      activityId: activity.id,
      date: dayOf(activity),
      hr: activity.avgHeartRate,
      paceSecPerKm: activity.paceSecPerKm,
      tempC: activity.weather?.tempC ?? null,
      durationSeconds: activity.durationSeconds,
    }]
  })
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/**
 * The latest easy run against the athlete's recent normal: runs of similar
 * pace, temperature and length over the look-back. Heat is controlled for by
 * comparing only like days, not by correcting for it.
 */
export function assessFatigue(runs: EasyRunReading[]): FatigueReading | null {
  const ordered = [...runs].sort((left, right) => left.date.localeCompare(right.date))
  const run = ordered.at(-1)
  if (!run) return null
  const rules = CONTROLLED_THRESHOLD.fatigue
  const since = new Date(Date.parse(`${run.date}T00:00:00Z`) - rules.lookbackDays * DAY_MS).toISOString().slice(0, 10)
  const comparable = ordered.slice(0, -1).filter((candidate) => candidate.date >= since
    && candidate.tempC !== null && run.tempC !== null
    && Math.abs(candidate.tempC - run.tempC) <= rules.similarTempC
    && Math.abs(candidate.paceSecPerKm - run.paceSecPerKm) <= rules.similarPaceSecPerKm
    && Math.abs(candidate.durationSeconds - run.durationSeconds) <= run.durationSeconds * rules.similarDurationShare)
  if (comparable.length < rules.minComparables) return { run, normalHr: null, comparables: comparable.length, flagged: false }
  const normalHr = median(comparable.map((candidate) => candidate.hr))
  return { run, normalHr, comparables: comparable.length, flagged: run.hr - normalHr >= rules.hrAboveNormalBpm }
}

export interface FitnessCheck {
  date: string
  activityId: string
  seconds: number
  paceSecPerKm: number
  previous: { date: string; paceSecPerKm: number } | null
  /** The threshold pace this 5K implies by Daniels, to set beside Garmin's estimate. */
  impliedThresholdSecPerKm: number
  /** Each repetition length's current guide moved by the proportion the 5K pace moved since the previous check. */
  proposedGuides: { repClass: RepLengthClass; guide: NumberRange; proposedGuide: NumberRange }[]
}

const daysBefore = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)

/** The guide each repetition length is on now: its latest prescription up to the reference date, else its first. */
function currentGuides(byDate: Map<string, WorkoutPrescription[]>, referenceDate: string): Map<RepLengthClass, NumberRange> {
  const guides = new Map<RepLengthClass, NumberRange>()
  const dates = [...byDate.keys()].sort()
  const ordered = [...dates.filter((date) => date <= referenceDate), ...dates.filter((date) => date > referenceDate).reverse()]
  for (const date of ordered) {
    for (const workout of byDate.get(date)!) {
      const controlled = controlledStep(workout)
      if (!controlled) continue
      const repClass = repLengthClass(controlled.step.target.durationSeconds!)
      if (date <= referenceDate || !guides.has(repClass)) guides.set(repClass, controlled.step.target.paceSecPerKm!)
    }
  }
  return guides
}

/**
 * The latest 5K - a race, or a time trial the plan prescribed as one - read
 * as a fitness check: the threshold it implies, and the guides moved by as
 * much as the 5K moved since the check before it. The first check only sets
 * the baseline.
 */
export function readFitnessCheck(
  activities: Activity[],
  byDate: Map<string, WorkoutPrescription[]>,
  referenceDate: string,
  officialResults: Pick<OfficialRaceResult, 'activityId' | 'distanceMeters' | 'chipTimeSeconds'>[] = [],
): FitnessCheck | null {
  const rules = CONTROLLED_THRESHOLD.fitnessCheck
  const checks = activities
    .filter((activity) => isRun(activity) && dayOf(activity) <= referenceDate
      && activity.distanceKm >= rules.distanceKm.min && activity.distanceKm <= rules.distanceKm.max
      && (activity.type === 'Race' || (byDate.get(dayOf(activity)) ?? []).some((workout) => workout.type === 'race')))
    .sort((left, right) => dayOf(left).localeCompare(dayOf(right)))
  const latest = checks.at(-1)
  if (!latest || dayOf(latest) < daysBefore(referenceDate, rules.withinDays)) return null
  // A 5K is a measured course: the official chip time when there is one,
  // over 5 km, never the GPS distance - 5.25 km of GPS made a 4:18 race read 4:10.
  const official = new Map(officialResults.filter((result) => result.distanceMeters === 5_000).map((result) => [result.activityId, result.chipTimeSeconds]))
  const seconds = (activity: Activity) => official.get(activity.id) ?? activity.durationSeconds
  const pace = (activity: Activity) => Math.round(seconds(activity) / 5)
  const before = checks.at(-2)
  const previous = before && dayOf(before) >= daysBefore(dayOf(latest), rules.previousWithinDays) ? before : undefined
  const ratio = previous ? seconds(latest) / seconds(previous) : null
  return {
    date: dayOf(latest),
    activityId: latest.id,
    seconds: seconds(latest),
    paceSecPerKm: pace(latest),
    previous: previous ? { date: dayOf(previous), paceSecPerKm: pace(previous) } : null,
    impliedThresholdSecPerKm: thresholdPaceFromVdot(vdotFromEffort(5, seconds(latest))),
    proposedGuides: ratio === null ? [] : [...currentGuides(byDate, referenceDate)].map(([repClass, guide]) => ({
      repClass,
      guide,
      proposedGuide: { min: Math.round(guide.min * ratio), max: Math.round(guide.max * ratio) },
    })),
  }
}

export interface AutoregulationReport {
  referenceDate: string
  controlledSessions: ControlledSessionReading[]
  guideProposals: GuideProposal[]
  fatigue: FatigueReading | null
  fitnessCheck: FitnessCheck | null
}

/** Plans newest first: the current one, then the archive. Only runs up to the reference date are read. */
export function autoregulationReport(
  activities: Activity[],
  plans: CoachingPlan[],
  referenceDate: string,
  officialResults: Pick<OfficialRaceResult, 'activityId' | 'distanceMeters' | 'chipTimeSeconds'>[] = [],
): AutoregulationReport {
  const byDate = prescriptionsByDate(plans)
  const since = new Date(Date.parse(`${referenceDate}T00:00:00Z`) - CONTROLLED_THRESHOLD.fatigue.lookbackDays * DAY_MS).toISOString().slice(0, 10)
  const past = activities.filter((activity) => isRun(activity) && dayOf(activity) <= referenceDate)
  const controlledSessions = past
    .filter((activity) => dayOf(activity) >= since)
    .flatMap((activity) => (byDate.get(dayOf(activity)) ?? [])
      .map((prescription) => readControlledSession(activity, prescription))
      .filter((reading): reading is ControlledSessionReading => reading !== null))
    .sort((left, right) => left.date.localeCompare(right.date))
  return {
    referenceDate,
    controlledSessions,
    guideProposals: proposeGuideChanges(controlledSessions.filter((reading) => reading.verdict !== 'unreadable')),
    fatigue: assessFatigue(easyRuns(past, byDate)),
    fitnessCheck: readFitnessCheck(past, byDate, referenceDate, officialResults),
  }
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
const middle = (range: NumberRange) => Math.round((range.min + range.max) / 2)
const replaceAll = (text: string, from: string, to: string) => text.split(from).join(to)

/** Every note a session carries, at any depth, rewritten. */
function rewriteNotes(workout: WorkoutPrescription, rewrite: (note: string) => string): WorkoutPrescription {
  return {
    ...workout,
    ...(workout.notes ? { notes: workout.notes.map(rewrite) } : {}),
    blocks: workout.blocks.map((block) => block.kind === 'repeat'
      ? { ...block, steps: block.steps.map((step) => step.notes ? { ...step, notes: step.notes.map(rewrite) } : step) }
      : block.notes ? { ...block, notes: block.notes.map(rewrite) } : block),
  }
}

/**
 * A controlled threshold session moved to a new guide, with its name, structure and the guide quoted
 * in its notes following - a name is not allowed to state a pace the blocks
 * no longer prescribe. Null for a session not on the guide being moved.
 */
export function withGuide(workout: WorkoutPrescription, from: NumberRange, to: NumberRange): WorkoutPrescription | null {
  const controlled = controlledStep(workout)
  const guide = controlled?.step.target.paceSecPerKm
  if (!guide || guide.min !== from.min || guide.max !== from.max) return null
  const moved: WorkoutPrescription = {
    ...workout,
    title: replaceAll(workout.title, `@ ${clock(middle(from))}`, `@ ${clock(middle(to))}`),
    ...(workout.structure?.targetPace ? { structure: { ...workout.structure, targetPace: clock(middle(to)) } } : {}),
    blocks: workout.blocks.map((block) => block.kind !== 'repeat' ? block : {
      ...block,
      steps: block.steps.map((step) => step === controlled!.step ? { ...step, target: { ...step.target, paceSecPerKm: to } } : step),
    }),
  }
  return rewriteNotes(moved, (note) => replaceAll(note, `${clock(from.min)}-${clock(from.max)}`, `${clock(to.min)}-${clock(to.max)}`))
}

const km = (metres: number) => `${Number((metres / 1_000).toFixed(1))} km`

/**
 * The athlete's lighter week, session by session: a controlled threshold session keeps about two
 * thirds of its repetitions, easy running about four fifths of its length;
 * every run stays, strides and pace guides with it. Null for a session it
 * leaves alone.
 */
export function lighterWorkout(workout: WorkoutPrescription): WorkoutPrescription | null {
  const { thresholdCut, easyCut } = CONTROLLED_THRESHOLD.lighterWeek
  const controlled = controlledStep(workout)
  if (controlled) {
    const repetitions = Math.max(1, Math.round(controlled.repetitions * (1 - thresholdCut)))
    if (repetitions === controlled.repetitions) return null
    return {
      ...workout,
      title: workout.title.replace(`${controlled.repetitions} ×`, `${repetitions} ×`),
      ...(workout.shortName ? { shortName: workout.shortName.replace(`${controlled.repetitions}×`, `${repetitions}×`) } : {}),
      ...(workout.structure?.reps ? { structure: { ...workout.structure, reps: repetitions } } : {}),
      blocks: workout.blocks.map((block) => block.kind === 'repeat' && block.steps.includes(controlled.step) ? { ...block, repetitions } : block),
    }
  }
  if (!EASY_TYPES.has(workout.type)) return null
  let title = workout.title
  const blocks = workout.blocks.map((block) => {
    if (block.kind !== 'effort') return block
    const { distanceMeters, durationSeconds } = block.target
    if (distanceMeters !== undefined) {
      const shorter = Math.max(1_000, Math.round((distanceMeters * (1 - easyCut)) / 500) * 500)
      title = title.replace(km(distanceMeters), km(shorter))
      return { ...block, target: { ...block.target, distanceMeters: shorter } }
    }
    if (durationSeconds !== undefined) {
      return { ...block, target: { ...block.target, durationSeconds: Math.max(600, Math.round((durationSeconds * (1 - easyCut)) / 60) * 60) } }
    }
    return block
  })
  return { ...workout, title, blocks }
}

/**
 * The sessions a lighter week would take: the rest of the flagged run's week,
 * or the whole of the next one when fewer than two of this week's remain.
 */
export function lighterWeekSessions(plan: CoachingPlan, flaggedDate: string, referenceDate: string): WorkoutPrescription[] {
  const after = flaggedDate > referenceDate ? flaggedDate : referenceDate
  const upcoming = plan.weeks
    .flatMap((week) => week.workouts.map((workout) => ({ week, workout })))
    .filter(({ workout }) => workout.status !== 'cancelled' && workout.date > after)
  const thisWeek = upcoming.filter(({ week }) => week.startDate <= after && week.endDate >= after)
  if (thisWeek.length >= 2) return thisWeek.map(({ workout }) => workout)
  const next = upcoming.find(({ week }) => week.startDate > after)?.week
  return next ? upcoming.filter(({ week }) => week === next).map(({ workout }) => workout) : []
}
