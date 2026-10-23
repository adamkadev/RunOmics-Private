import type { BootstrapWeekDraft, BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingWorkoutType, WorkoutSegment } from '@/domain/coaching/types'
import { segmentMeters, segments, trainingWeekShare, weekKm } from './volume'
import { CONTROLLED_THRESHOLD } from './controlledThreshold'

// Daniels' per-workout rules of thumb, applied to the week's own planned distance: a historical
// average would stop binding in the lightest week, the week it matters in.
const THRESHOLD_SHARE = 0.1
const INTERVAL_SHARE = 0.08
// Seiler's 80/20 as a ceiling on the week actually prescribed: it never fires at full weeks (10 + 8 < 20),
// but stops a short week scaled to full size from being swallowed by hard running.
const COMBINED_SHARE = 0.2

// GetTrainingZones' threshold zone: 0.98-1.02 of the measured pace.
const THRESHOLD_SLOW_MULTIPLIER = 1.02
const THRESHOLD_FAST_MULTIPLIER = 0.98

// Rounding tolerance in s/km, faster only: pace is held for the whole block, and a slower week is no hazard.
const DRIFT_SEC: Partial<Record<CoachingWorkoutType, number>> = {
  tempo: 3,
  threshold: 3,
  vo2max: 4,
  anaerobic: 4,
  sprint: 4,
}

// Growth ceilings for time at threshold: in one week, and over any two.
const STEP_CEILING = 1.25
const TWO_WEEK_CEILING = 1.4

// A stride (about 20 s) is neuromuscular, not a quality dose; anything longer wearing the label is an effort.
const STRIDE_MAX_SECONDS = 60

// A proportion of a week this small polices nothing; validateDraftVolume's floor, run first, judges it.
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

function classify(segment: WorkoutSegment, type: CoachingWorkoutType, band: IntensityBand): Intensity {
  if (segment.kind === 'warmup' || segment.kind === 'cooldown' || segment.kind === 'recovery') return 'easy'
  if (segment.kind === 'strides') {
    const seconds = segment.target.durationSeconds ?? 0
    if (seconds > 0 && seconds <= STRIDE_MAX_SECONDS) return 'easy'
  }

  const fastest = segment.target.paceSecPerKm?.min
  // A controlled threshold guide may sit slower than the band and still be quality: read it from the
  // session's type and its HR cap, never from the guide, unless the guide reaches interval pace.
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
   * Keyed by the session's type, not by where it landed in the band: drifting out of the band is the drift
   * looked for. Controlled threshold guides are set per repetition length, so each length is its own key.
   */
  fastest: Map<string, { type: CoachingWorkoutType; pace: number; label: string }>
}

function emptyDose(): WorkoutDose {
  return { thresholdMeters: 0, intervalMeters: 0, thresholdSeconds: 0, controlledSeconds: 0, runningSeconds: 0, fastest: new Map() }
}

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

/** Counted by distance, a timed segment converted through its own prescribed pace, as validateDraftVolume counts. */
export function validateDraftIntensity(
  draft: CoachingPlanDraft,
  band: IntensityBand | null,
  availableWeekdays: number[],
  before?: CoachingPlanDraft,
  // An accepted pace-guide change is the one way a guide may move inside a block.
  options: { guideChange?: boolean } = {},
): void {
  if (band === null) return

  // An adaptation is judged only on the weeks it made harder: cutting easy running raises the hard share,
  // and refusing that would leave the heavier week in place.
  const previous = new Map(before?.weeks.map((week) => [week.startDate, weekDose(week, band)]))
  const judged = ({ week, dose }: WeekDose) => before === undefined || hardened(dose, previous.get(week.startDate))

  const doses: WeekDose[] = draft.weeks.map((week) => ({
    week,
    km: weekKm(week),
    // A block opening midweek loses a day already trained, so the session is judged against the full week.
    share: trainingWeekShare(week, availableWeekdays),
    dose: weekDose(week, band),
  }))

  // Before the caps: a repetition drifted out of the threshold band trips the interval cap first and reports the wrong problem.
  if (!options.guideChange) driftCheck(doses, judged)

  for (const entry of doses) {
    const { week, km, share, dose } = entry
    if (km < MEANINGFUL_WEEK_KM || share === 0 || !judged(entry)) continue
    const thresholdKm = round(dose.thresholdMeters / 1_000)
    const intervalKm = round(dose.intervalMeters / 1_000)
    // Scaled to the full week, but never past the ceiling on hard running in the distance actually prescribed.
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

/** A part week at either end of the block always looks like a drop or a jump, so it is no evidence of either. */
function loadingWeeks(doses: WeekDose[]): WeekDose[] {
  return doses.filter(({ week, km, share }) => km >= MEANINGFUL_WEEK_KM && share >= 1 && week.reducedVolume === undefined)
}

/**
 * Controlled threshold time may hold - a repeated week is the point of the method - and its growth is bounded.
 * A week after a lighter one is measured against the loading week before it, so returning to the dose is no jump.
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

/** Against the block's first prescription, not the week before, so tolerable steps cannot add up to an intolerable drift. */
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
 * Pace is held, so time at threshold is what has to move across the loading weeks. Pace-led threshold only:
 * a controlled threshold session may repeat its week, and controlledRampCheck bounds its growth.
 */
function progressionCheck(doses: WeekDose[]): void {
  const loading = loadingWeeks(doses)
  if (loading.length < 2) return
  // A block may carry no threshold work at all, as post-race recovery does, but not some left flat.
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
