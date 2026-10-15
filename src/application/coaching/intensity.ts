import type { BootstrapWeekDraft, BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingWorkoutType, WorkoutSegment } from '@/domain/coaching/types'
import { segmentMeters, segments, trainingWeekShare, weekKm } from './volume'
import { CONTROLLED_THRESHOLD } from './controlledThreshold'

// Daniels' per-workout rules of thumb, re-keyed to the week's own planned
// distance: a denominator taken from a historical average would stop binding
// in the lightest week, which is the week it matters in.
const THRESHOLD_SHARE = 0.1
const INTERVAL_SHARE = 0.08
// Seiler's 80/20, read as a conservative ceiling rather than a law. Against
// the week actually prescribed, so scaling a partial week up cannot let hard
// running swallow it: at full weeks 10 + 8 never reaches 20 and this never
// fires, but a two-day week scaled to full size would without it.
const COMBINED_SHARE = 0.2

// The zone multipliers in GetTrainingZones: threshold is 0.98-1.02 of the
// measured pace, so its slow edge divides quality from aerobic running and its
// fast edge divides threshold from everything sharper.
const THRESHOLD_SLOW_MULTIPLIER = 1.02
const THRESHOLD_FAST_MULTIPLIER = 0.98

// Held fixed for the whole block; the tolerance is for rounding a rep, not for
// getting fitter mid-block. Faster only - a slower week is not a hazard.
const DRIFT_SEC: Partial<Record<CoachingWorkoutType, number>> = {
  tempo: 3,
  threshold: 3,
  vo2max: 4,
  anaerobic: 4,
  sprint: 4,
}

// Time at threshold has to rise across the loading weeks or the block trains
// nothing, but not by more than this in a week, nor this over any two.
const STEP_CEILING = 1.25
const TWO_WEEK_CEILING = 1.4

// A stride is neuromuscular, not a quality dose, and the schema already pins
// it at about 20 seconds. Anything longer wearing the label is an effort.
const STRIDE_MAX_SECONDS = 60

// As with volume.ts's long-run allowance, a proportion of a week this small
// polices nothing: the week is not a training week, and validateDraftVolume's
// floor - which runs first - is what has something to say about it.
const MEANINGFUL_WEEK_KM = 10

export type Intensity = 'easy' | 'threshold' | 'controlled' | 'interval'

export interface IntensityBand {
  /** At or faster than this, running stops counting as aerobic volume. */
  qualitySecPerKm: number
  /** Faster than this, it is no longer threshold. */
  intervalSecPerKm: number
}

export function intensityBand(thresholdPaceSecPerKm: number | null | undefined): IntensityBand | null {
  if (!thresholdPaceSecPerKm || thresholdPaceSecPerKm <= 0) return null
  return {
    qualitySecPerKm: Math.round(thresholdPaceSecPerKm * THRESHOLD_SLOW_MULTIPLIER),
    intervalSecPerKm: Math.round(thresholdPaceSecPerKm * THRESHOLD_FAST_MULTIPLIER),
  }
}

/**
 * Warm-ups, cool-downs and recovery jogs are easy volume: they count toward
 * the week and sit outside the caps, so a session is judged on the work it
 * prescribes rather than on the running that surrounds it.
 */
function classify(segment: WorkoutSegment, type: CoachingWorkoutType, band: IntensityBand): Intensity {
  if (segment.kind === 'warmup' || segment.kind === 'cooldown' || segment.kind === 'recovery') return 'easy'
  if (segment.kind === 'strides') {
    const seconds = segment.target.durationSeconds ?? 0
    if (seconds > 0 && seconds <= STRIDE_MAX_SECONDS) return 'easy'
  }

  const fastest = segment.target.paceSecPerKm?.min
  // A controlled threshold session is run by pace with heart rate as its limit, so its guide may sit
  // slower than the threshold band and it is quality all the same: read it
  // from the session's type and its cap, never from the guide. Only a guide
  // reaching interval pace makes it something else.
  if (type === 'threshold' && segment.kind === 'effort' && segment.target.hrBpm !== undefined) {
    return fastest !== undefined && fastest < band.intervalSecPerKm ? 'interval' : 'controlled'
  }
  if (fastest !== undefined) {
    if (fastest < band.intervalSecPerKm) return 'interval'
    return fastest <= band.qualitySecPerKm ? 'threshold' : 'easy'
  }

  // Hill repetitions and race-effort blocks carry no pace by design, so the
  // workout's own type is the only thing left to read them by.
  switch (type) {
    case 'threshold':
    case 'tempo':
      return 'threshold'
    case 'vo2max':
    case 'anaerobic':
    case 'sprint':
      return 'interval'
    default:
      return 'easy'
  }
}

interface WorkoutDose {
  /** Pace-led threshold repetitions, held to the threshold cap. */
  thresholdMeters: number
  intervalMeters: number
  thresholdSeconds: number
  /** Controlled threshold repetitions, held to CONTROLLED_THRESHOLD.dose instead of the threshold cap. */
  controlledSeconds: number
  /** Everything prescribed but a race, the denominator of the controlled threshold share. */
  runningSeconds: number
  /**
   * The fastest repetition prescribed in each kind of quality session, keyed
   * by the session's own type rather than by which side of the threshold band
   * it landed on - drifting out of the band is the drift being looked for. A
   * controlled threshold guide is set by repetition length, slower for longer, so each of
   * its lengths is a kind of its own.
   */
  fastest: Map<string, { type: CoachingWorkoutType; pace: number; label: string }>
}

function emptyDose(): WorkoutDose {
  return { thresholdMeters: 0, intervalMeters: 0, thresholdSeconds: 0, controlledSeconds: 0, runningSeconds: 0, fastest: new Map() }
}

/** The mirror of segmentMeters: whichever of the two the segment was written in. Shared with workoutNames.ts. */
export function segmentSeconds(segment: WorkoutSegment): number {
  const { durationSeconds, distanceMeters, paceSecPerKm } = segment.target
  if (durationSeconds !== undefined) return durationSeconds
  if (distanceMeters !== undefined && paceSecPerKm !== undefined) {
    return (distanceMeters * (paceSecPerKm.min + paceSecPerKm.max)) / 2_000
  }
  return 0
}

function addDose(workout: BootstrapWorkoutDraft, band: IntensityBand, dose: WorkoutDose): void {
  // A race is the point of the block, not a dose to be rationed against it.
  if (workout.type === 'race') return

  for (const { segment, repetitions } of segments(workout.blocks)) {
    dose.runningSeconds += segmentSeconds(segment) * repetitions
    const intensity = classify(segment, workout.type, band)
    if (intensity === 'easy') continue

    if (intensity === 'threshold') {
      dose.thresholdMeters += segmentMeters(segment) * repetitions
      dose.thresholdSeconds += segmentSeconds(segment) * repetitions
    } else if (intensity === 'controlled') {
      dose.controlledSeconds += segmentSeconds(segment) * repetitions
    } else {
      dose.intervalMeters += segmentMeters(segment) * repetitions
    }

    const pace = segment.target.paceSecPerKm?.min
    if (pace === undefined || DRIFT_SEC[workout.type] === undefined) continue
    const length = segmentSeconds(segment)
    const key = intensity === 'controlled' ? `${workout.type}:${length}` : workout.type
    const label = intensity === 'controlled' ? `${workout.type} ${minutes(length)}-minute repetitions` : workout.type
    const seen = dose.fastest.get(key)
    if (seen === undefined || pace < seen.pace) dose.fastest.set(key, { type: workout.type, pace, label })
  }
}

function weekDose(week: BootstrapWeekDraft, band: IntensityBand): WorkoutDose {
  const dose = emptyDose()
  for (const workout of week.workouts) addDose(workout, band, dose)
  return dose
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function minutes(seconds: number): number {
  return Math.round(seconds / 60)
}

interface WeekDose {
  week: BootstrapWeekDraft
  km: number
  share: number
  dose: WorkoutDose
}

/**
 * A week can pass every volume check and still be the wrong week: the total
 * says nothing about how much of it was hard, nor about how fast "hard" was
 * this time. Two bounds on the dose, one on the pace, one on the shape of the
 * block. Everything is counted by distance, converting a timed segment through
 * its own prescribed pace, the same basis validateDraftVolume uses.
 */
export function validateDraftIntensity(
  draft: CoachingPlanDraft,
  band: IntensityBand | null,
  availableWeekdays: number[],
  before?: CoachingPlanDraft,
  // A pace-guide change the athlete's own runs called for, and they accepted,
  // is the one way a guide may move inside a block; drift is everything else.
  options: { guideChange?: boolean } = {},
): void {
  if (band === null) return

  // An adaptation, as in validateDraftVolume: only a week the change made
  // harder is judged. Taking easy running out of a week raises its hard share
  // without adding a metre of hard running, and refusing that would leave the
  // heavier week in place. Progression is a demand on a block being written.
  const previous = new Map(before?.weeks.map((week) => [week.startDate, weekDose(week, band)]))
  const judged = ({ week, dose }: WeekDose) => before === undefined || hardened(dose, previous.get(week.startDate))

  const doses: WeekDose[] = draft.weeks.map((week) => ({
    week,
    km: weekKm(week),
    // A block opening on a Wednesday loses a running day the athlete has
    // already trained, so judging the session against the stub understates
    // the week it belongs to. The same full-week scaling volume.ts applies to
    // the cutback and to the long run.
    share: trainingWeekShare(week, availableWeekdays),
    dose: weekDose(week, band),
  }))

  // Before the caps, because a repetition that drifted out of the threshold
  // band trips the interval cap first and reports the wrong problem.
  if (!options.guideChange) driftCheck(doses, judged)

  for (const entry of doses) {
    const { week, km, share, dose } = entry
    if (km < MEANINGFUL_WEEK_KM || share === 0 || !judged(entry)) continue
    const thresholdKm = round(dose.thresholdMeters / 1_000)
    const intervalKm = round(dose.intervalMeters / 1_000)
    // Scaled to the week the session really sits in, but never past the
    // ceiling on hard running in the distance actually prescribed.
    const cap = (portion: number) => round(Math.min((km / share) * portion, km * COMBINED_SHARE))

    if (thresholdKm > cap(THRESHOLD_SHARE)) {
      throw new Error(`Week ${week.startDate} prescribes ${thresholdKm} km at threshold within ${km} km, over the ${cap(THRESHOLD_SHARE)} km this week allows; hold the pace and cut repetitions`)
    }
    if (intervalKm > cap(INTERVAL_SHARE)) {
      throw new Error(`Week ${week.startDate} prescribes ${intervalKm} km of intervals within ${km} km, over the ${cap(INTERVAL_SHARE)} km this week allows; hold the pace and cut repetitions`)
    }
    const hardKm = round(thresholdKm + intervalKm)
    if (hardKm > round(km * COMBINED_SHARE)) {
      throw new Error(`Week ${week.startDate} runs ${hardKm} km of its ${km} km at threshold or faster, over the ${round(km * COMBINED_SHARE)} km ceiling on hard running; move the remainder into easy running`)
    }
    // A share of time, so a part week is judged as it stands: both sides of
    // the ratio shrink with it.
    const controlledCeiling = CONTROLLED_THRESHOLD.dose.maxShareOfRunningTime
    if (dose.controlledSeconds > dose.runningSeconds * controlledCeiling) {
      throw new Error(`Week ${week.startDate} prescribes ${minutes(dose.controlledSeconds)} min of controlled threshold in ${minutes(dose.runningSeconds)} min of running, over the ${Math.round(controlledCeiling * 100)}% ceiling; cut repetitions`)
    }
  }

  controlledRampCheck(doses, judged)
  if (before === undefined) progressionCheck(doses)
}

/**
 * The weeks whose dose can be compared: a full training week, at volume, not
 * a declared reduction. A part week at either end of the block always looks
 * like a drop or a jump, so it is no evidence of either.
 */
function loadingWeeks(doses: WeekDose[]): WeekDose[] {
  return doses.filter(({ week, km, share }) => km >= MEANINGFUL_WEEK_KM && share >= 1 && week.reducedVolume === undefined)
}

/**
 * Controlled threshold time may grow, or hold - a repeated week is the point of the method -
 * but never by more than CONTROLLED_THRESHOLD.dose allows in a week, nor past the ceilings
 * time at threshold answers to. A week after a lighter one is measured
 * against the loading week before it, so returning to the dose is no jump.
 */
function controlledRampCheck(doses: WeekDose[], judged: (entry: WeekDose) => boolean): void {
  const loading = loadingWeeks(doses)
  const step = CONTROLLED_THRESHOLD.dose.maxWeeklyStepMinutes * 60
  for (let index = 1; index < loading.length; index++) {
    const current = loading[index]!
    if (!judged(current)) continue
    const before = loading[index - 1]!.dose.controlledSeconds
    const now = current.dose.controlledSeconds
    if (now - before > step) {
      throw new Error(`Week ${current.week.startDate} takes controlled threshold time from ${minutes(before)} to ${minutes(now)} min, more than the ${CONTROLLED_THRESHOLD.dose.maxWeeklyStepMinutes} min a week it may grow`)
    }
    if (before > 0 && now > before * STEP_CEILING) {
      throw new Error(`Week ${current.week.startDate} takes controlled threshold time from ${minutes(before)} to ${minutes(now)} min, beyond the quarter a week it may climb`)
    }
    const twoBack = loading[index - 2]?.dose.controlledSeconds ?? 0
    if (twoBack > 0 && now > twoBack * TWO_WEEK_CEILING) {
      throw new Error(`Week ${current.week.startDate} takes controlled threshold time from ${minutes(twoBack)} to ${minutes(now)} min across two weeks, beyond the two-week ceiling`)
    }
  }
}

/** More hard running than the same week held before, or a faster repetition. */
function hardened(dose: WorkoutDose, prior: WorkoutDose | undefined): boolean {
  if (prior === undefined) return true
  if (dose.thresholdMeters > prior.thresholdMeters || dose.intervalMeters > prior.intervalMeters) return true
  if (dose.controlledSeconds > prior.controlledSeconds) return true
  for (const [key, { pace }] of dose.fastest) {
    const seen = prior.fastest.get(key)
    if (seen === undefined || pace < seen.pace) return true
  }
  return false
}

/**
 * The documented failure of controlled-intensity training is repetitions
 * creeping faster week by week until a sub-threshold block is three threshold
 * sessions. Measured against the block's first prescription rather than the
 * week before, so three tolerable steps cannot add up to an intolerable drift.
 */
function driftCheck(doses: WeekDose[], judged: (entry: WeekDose) => boolean): void {
  const baselines = new Map<string, { pace: number; startDate: string }>()
  for (const entry of doses) {
    const { week, dose } = entry
    for (const [key, { type, pace, label }] of dose.fastest) {
      const baseline = baselines.get(key)
      if (baseline === undefined) {
        baselines.set(key, { pace, startDate: week.startDate })
        continue
      }
      if (judged(entry) && baseline.pace - pace > DRIFT_SEC[type]!) {
        throw new Error(`Week ${week.startDate} prescribes ${label} at ${pace} s/km against ${baseline.pace} s/km in the week of ${baseline.startDate}; hold the pace across the block and progress by repetitions`)
      }
    }
  }
}

/**
 * Progress by repetition count first, then repetition length, holding pace
 * fixed - which leaves time at threshold as the quantity that has to move. A
 * block going 4.8, 4.0, 3.6, 4.8 km develops nothing. Reduced weeks are
 * exempt: shedding quality is what they are for. Pace-led threshold only: a
 * controlled threshold session may repeat its week, and controlledRampCheck bounds how fast it grows.
 */
function progressionCheck(doses: WeekDose[]): void {
  const loading = loadingWeeks(doses)
  if (loading.length < 2) return
  // A block may legitimately carry no threshold work at all, as post-race
  // recovery does. It may not carry some and leave it flat.
  if (loading.every(({ dose }) => dose.thresholdSeconds === 0)) return

  for (let index = 1; index < loading.length; index++) {
    const previous = loading[index - 1]!
    const current = loading[index]!
    const before = previous.dose.thresholdSeconds
    const now = current.dose.thresholdSeconds

    if (now <= before) {
      throw new Error(`Week ${current.week.startDate} holds time at threshold at ${minutes(now)} min against ${minutes(before)} min the loading week before; add repetitions or lengthen them`)
    }
    if (before > 0 && now > before * STEP_CEILING) {
      throw new Error(`Week ${current.week.startDate} takes time at threshold from ${minutes(before)} to ${minutes(now)} min, beyond the quarter a week it may climb`)
    }
    const twoBack = loading[index - 2]
    if (twoBack !== undefined && twoBack.dose.thresholdSeconds > 0 && now > twoBack.dose.thresholdSeconds * TWO_WEEK_CEILING) {
      throw new Error(`Week ${current.week.startDate} takes time at threshold from ${minutes(twoBack.dose.thresholdSeconds)} to ${minutes(now)} min across two weeks, beyond the two-week ceiling`)
    }
  }
}
