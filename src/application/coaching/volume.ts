import { DAY_MS } from '@/lib/calendarDate'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import type { NumberRange, WorkoutBlock, WorkoutSegment } from '@/domain/coaching/types'
import { blocksMeters, planEasyPace } from '@/domain/coaching/sessionDistance'
import { CONTROLLED_THRESHOLD } from './controlledThreshold'

// A non-taper week should hold what the athlete just ran; the tolerance is for rounding a week's
// sessions, not for easing off without saying so.
const FLOOR_RATIO = 0.95
const CEILING_RATIO = 1.05
// A percentage ceiling means nothing to someone returning on 5 km a week.
const CEILING_ALLOWANCE_KM = 3
const RAMP_RATIO = 1.12
const RAMP_ALLOWANCE_KM = 2
const FOCUS_TOLERANCE = 0.1
// 10% below the block's peak is the smallest gap that cannot be rounding or a rest day.
const REDUCTION_MARGIN = 0.9
// The long-run step has a hazard ratio behind it, though from one observational cohort - hence a step
// rather than a hard ceiling. The share is convention.
const LONG_RUN_STEP = 1.1
const LONG_RUN_SHARE = 0.3
// Below this the proportions police nothing: 10% more than a 3 km longest run is 300 metres.
const LONG_RUN_ALLOWANCE_KM = 8

const KM_IN_PROSE = /(\d+(?:[.,]\d+)?)\s*km/gi

// recent7DaysKm is a rolling window, so a block built midweek can read well under the last completed
// week; after a gap longer than this, that week is history rather than capacity.
const COMPLETED_WEEK_STALE_DAYS = 3

/** weeklySeries ends with the week in progress, so the one before it is the last complete one. */
function lastCompletedWeekKm(history: TrainingHistory): number {
  const since = history.daysSinceLastRun
  if (since === null || since > COMPLETED_WEEK_STALE_DAYS) return 0
  const weeks = history.weeklySeries.km
  return weeks.length >= 2 ? weeks[weeks.length - 2]! : 0
}

/**
 * The floor follows the most recent of the three figures and the ceiling the sustained one:
 * a month of travel drags the 28-day mean far below both.
 */
export interface VolumeBand {
  baselineKm: number
  capacityKm: number
  longestRunKm: number
  /** The athlete's own cap from athlete.json; absent means none. */
  maxWeeklyKm?: number
}

export function volumeBand(history: TrainingHistory, maxWeeklyKm?: number): VolumeBand {
  const baselineKm = Math.max(history.recent7DaysKm, lastCompletedWeekKm(history), history.recentWeeklyAverageKm)
  return {
    ...(maxWeeklyKm ? { maxWeeklyKm } : {}),
    baselineKm,
    capacityKm: Math.max(history.best4WeekAverageKm, baselineKm),
    // A month off the road leaves no recent long run, but the tolerance built over the quarter has not vanished.
    longestRunKm: history.longestRunLast30DaysKm || history.longestRunLast90DaysKm,
  }
}

/** The bounds a whole week answers to as a block's first week, before any peak of its own. */
export function fullWeekLimits(band: VolumeBand): { ceilingKm: number; rampKm: number } {
  return {
    ceilingKm: round(band.capacityKm * CEILING_RATIO + CEILING_ALLOWANCE_KM),
    rampKm: band.baselineKm * RAMP_RATIO + RAMP_ALLOWANCE_KM,
  }
}

export interface WeekTarget {
  km: number
  lighter: boolean
}

/** A partial first week is a lead-in at week 1's level, so a block started midweek ends in its lighter week. */
export function blockWeekTargets(
  weekKmTargets: number[],
  weeks: Pick<BootstrapWeekDraft, 'startDate' | 'endDate'>[],
  availableWeekdays: number[],
): (WeekTarget | null)[] {
  const lighterIndex = weekKmTargets.length - 1
  let next = 0
  return weeks.map((week, index) => {
    const share = trainingWeekShare(week, availableWeekdays)
    if (share === 0) return null
    const leadIn = index === 0 && share < 1 && weeks.length > 1
    const position = leadIn ? 0 : Math.min(next++, lighterIndex)
    return { km: round(weekKmTargets[position]! * share), lighter: position === lighterIndex }
  })
}

export function longSessionLimitKm(band: VolumeBand, fullWeekKm: number): number {
  const recentBound = band.longestRunKm > 0 ? band.longestRunKm * LONG_RUN_STEP : Infinity
  return Math.max(Math.min(fullWeekKm * LONG_RUN_SHARE, recentBound), LONG_RUN_ALLOWANCE_KM)
}

export function segments(blocks: WorkoutBlock[]): { segment: WorkoutSegment; repetitions: number }[] {
  return blocks.flatMap((block) => block.kind === 'repeat'
    ? block.steps.map((step) => ({ segment: step, repetitions: block.repetitions }))
    : [{ segment: block, repetitions: 1 }])
}

export { segmentMeters } from '@/domain/coaching/sessionDistance'

/** Timed threshold work and pace-less warm-ups are run too: counting `distanceMeters` alone reads a week light. */
export function weekKm(week: BootstrapWeekDraft, easyPace: NumberRange | null = planEasyPace(week.workouts)): number {
  const meters = week.workouts.reduce((total, workout) => total + blocksMeters(workout.blocks, easyPace), 0)
  return Math.round(meters) / 1_000
}

/**
 * Counted in the days this athlete runs, not calendar days: a block starting on a Tuesday is a whole
 * week for a Tue-Sun runner and must carry a whole week's volume.
 */
export function trainingWeekShare(week: Pick<BootstrapWeekDraft, 'startDate' | 'endDate'>, availableWeekdays: number[]): number {
  if (availableWeekdays.length === 0) return 0
  const start = Date.parse(week.startDate)
  const days = Math.round((Date.parse(week.endDate) - start) / DAY_MS) + 1
  const present = new Set<number>()
  for (let offset = 0; offset < Math.min(days, 7); offset++) {
    present.add(new Date(start + offset * DAY_MS).getUTCDay())
  }
  return availableWeekdays.filter((weekday) => present.has(weekday)).length / availableWeekdays.length
}

function focusContradictsPrescription(week: BootstrapWeekDraft, km: number): number | null {
  for (const match of week.focus.matchAll(KM_IN_PROSE)) {
    const claimed = Number((match[1] ?? '').replace(',', '.'))
    if (claimed > 0 && Math.abs(claimed - km) / km > FOCUS_TOLERANCE) return claimed
  }
  return null
}

function longestSession(week: BootstrapWeekDraft, weekTotalKm: number, share: number, band: VolumeBand, easyPace: NumberRange | null): void {
  // Against a whole week's worth, not this week's total: a Friday-to-Sunday
  // tail holds two runs, and one of them being most of it is arithmetic.
  const shareBound = (weekTotalKm / share) * LONG_RUN_SHARE
  const recentBound = band.longestRunKm > 0 ? band.longestRunKm * LONG_RUN_STEP : Infinity
  const limit = longSessionLimitKm(band, weekTotalKm / share)

  for (const workout of week.workouts) {
    const km = round(blocksMeters(workout.blocks, easyPace) / 1_000)
    if (km <= limit) continue

    const reason = recentBound < shareBound
      ? `the longest run of the last months was ${band.longestRunKm} km`
      : `that is over ${Math.round(LONG_RUN_SHARE * 100)}% of a full week at this volume`
    throw new Error(`${workout.date} prescribes a ${km} km session but ${reason}; shorten it to ${round(limit)} km or less`)
  }
}

/**
 * With `before`, this checks an adaptation: only a week the change added kilometres to is judged, and only
 * against the bounds on too much. The floor and reduced-week rules never refuse the easing an adaptation is for.
 */
export function validateDraftVolume(
  draft: CoachingPlanDraft,
  band: VolumeBand,
  availableWeekdays: number[],
  before?: CoachingPlanDraft,
  returning = false,
  targets?: (WeekTarget | null)[],
): void {
  if (!(band.baselineKm > 0)) return

  const adapting = before !== undefined
  // A return writes every walk as a bare duration, so there an untargeted step is walked, not run.
  const easyPaceOf = (week: BootstrapWeekDraft) => (returning ? null : planEasyPace(week.workouts))
  const previousKm = new Map(before?.weeks.map((week) => [week.startDate, weekKm(week, easyPaceOf(week))]))

  // The one week per block that may sit under the floor, and only after the
  // arithmetic below agrees it is genuinely reduced.
  let reducedWeek: string | null = null

  // Against the block's peak so far, not the week just gone, so a cutback does not forbid the rebound after it.
  // Seeded from what the athlete has been running, or the block's first week would answer to nothing.
  let peakKm = band.baselineKm

  for (const [weekIndex, week] of draft.weeks.entries()) {
    const share = trainingWeekShare(week, availableWeekdays)
    if (share === 0) continue

    const target = adapting ? null : targets?.[weekIndex] ?? null
    const floorKm = round(band.baselineKm * share * FLOOR_RATIO)
    const ceilingKm = round(Math.min(
      band.capacityKm * share * CEILING_RATIO + CEILING_ALLOWANCE_KM,
      (band.maxWeeklyKm ?? Infinity) * share,
    ))
    const km = weekKm(week, easyPaceOf(week))
    // Nothing carried a distance, or a duration with a pace: an under-specified week is frequency's business.
    if (km === 0) continue
    const judged = !adapting || km > (previousKm.get(week.startDate) ?? 0)

    const claimed = adapting ? null : focusContradictsPrescription(week, km)
    if (claimed !== null) {
      throw new Error(`Week ${week.startDate} says ${claimed} km in its focus but prescribes ${km} km; make the focus match the workouts`)
    }

    // The targets were bounded when they were set, so they stand in for the floor and the ceiling.
    if (target) {
      if (Math.abs(km - target.km) > CONTROLLED_THRESHOLD.block.targetToleranceKm) {
        throw new Error(`Week ${week.startDate} prescribes ${km} km against the block's target of ${target.km} km; write it to the target`)
      }
      if (target.lighter && week.reducedVolume === undefined) {
        throw new Error(`Week ${week.startDate} is the block's lighter week; set week.reducedVolume with reason cutback`)
      }
    } else if (judged && km > ceilingKm) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km, beyond the ${ceilingKm} km this athlete has sustained; reduce it`)
    }

    const reduction = week.reducedVolume
    // Walks in a return carry no distance while the recorded kilometres include them, so those set no floor.
    if (!adapting && !returning && !target && km < floorKm && reduction === undefined) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km against a recent ${band.baselineKm} km; either build from that or set week.reducedVolume with the recovery, taper or cutback reason`)
    }

    // Declaring the reduction is not taking it. Compared at full-week scale so
    // a short opening week is not judged against a whole week's peak.
    if (!adapting && reduction !== undefined) {
      if (reducedWeek !== null) {
        throw new Error(`Week ${week.startDate} is a second reduced week after ${reducedWeek}; a block gets one, so build this one or move the reduction`)
      }
      const allowedKm = round(peakKm * REDUCTION_MARGIN * share)
      if (km > allowedKm) {
        throw new Error(`Week ${week.startDate} calls itself ${reduction.reason} at ${km} km but the block peaks at ${round(peakKm)} km; a reduced week has to be at or under ${allowedKm} km`)
      }
      reducedWeek = week.startDate
    }

    if (judged) longestSession(week, km, share, band, easyPaceOf(week))

    if (judged && km > peakKm * RAMP_RATIO + RAMP_ALLOWANCE_KM) {
      throw new Error(`Week ${week.startDate} jumps from ${round(peakKm)} km to ${km} km; increase weekly volume gradually`)
    }

    peakKm = Math.max(peakKm, km)
  }
}

function round(km: number): number {
  return Math.round(km * 10) / 10
}
