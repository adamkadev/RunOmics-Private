import { DAY_MS } from '@/lib/calendarDate'
import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import type { WorkoutBlock, WorkoutSegment } from '@/domain/coaching/types'

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
}

export function volumeBand(history: TrainingHistory): VolumeBand {
  const baselineKm = Math.max(history.recent7DaysKm, lastCompletedWeekKm(history), history.recentWeeklyAverageKm)
  return {
    baselineKm,
    capacityKm: Math.max(history.best4WeekAverageKm, baselineKm),
    // A month off the road leaves no recent long run, but the tolerance built over the quarter has not vanished.
    longestRunKm: history.longestRunLast30DaysKm || history.longestRunLast90DaysKm,
  }
}

export function segments(blocks: WorkoutBlock[]): { segment: WorkoutSegment; repetitions: number }[] {
  return blocks.flatMap((block) => block.kind === 'repeat'
    ? block.steps.map((step) => ({ segment: step, repetitions: block.repetitions }))
    : [{ segment: block, repetitions: 1 }])
}

/** Threshold work is usually prescribed by time, so counting `distanceMeters` alone can read a week 20 km light. */
export function segmentMeters(segment: WorkoutSegment): number {
  const { distanceMeters, durationSeconds, paceSecPerKm } = segment.target
  if (distanceMeters !== undefined) return distanceMeters
  if (durationSeconds !== undefined && paceSecPerKm !== undefined) {
    return (durationSeconds * 2_000) / (paceSecPerKm.min + paceSecPerKm.max)
  }
  return 0
}

export function weekKm(week: BootstrapWeekDraft): number {
  const meters = week.workouts.reduce((total, workout) => total
    + segments(workout.blocks).reduce((sum, { segment, repetitions }) => sum + segmentMeters(segment) * repetitions, 0), 0)
  return Math.round(meters) / 1_000
}

/**
 * Counted in the days this athlete runs, not calendar days: a block starting on a Tuesday is a whole
 * week for a Tue-Sun runner and must carry a whole week's volume.
 */
export function trainingWeekShare(week: BootstrapWeekDraft, availableWeekdays: number[]): number {
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

function longestSession(week: BootstrapWeekDraft, weekTotalKm: number, share: number, band: VolumeBand): void {
  // Against a whole week's worth, not this week's total: a Friday-to-Sunday
  // tail holds two runs, and one of them being most of it is arithmetic.
  const shareBound = (weekTotalKm / share) * LONG_RUN_SHARE
  const recentBound = band.longestRunKm > 0 ? band.longestRunKm * LONG_RUN_STEP : Infinity
  const limit = Math.max(Math.min(shareBound, recentBound), LONG_RUN_ALLOWANCE_KM)

  for (const workout of week.workouts) {
    const km = round(segments(workout.blocks).reduce((sum, { segment, repetitions }) => sum + segmentMeters(segment) * repetitions, 0) / 1_000)
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
): void {
  if (!(band.baselineKm > 0)) return

  const adapting = before !== undefined
  const previousKm = new Map(before?.weeks.map((week) => [week.startDate, weekKm(week)]))

  // The one week per block that may sit under the floor, and only after the
  // arithmetic below agrees it is genuinely reduced.
  let reducedWeek: string | null = null

  // Against the block's peak so far, not the week just gone, so a cutback does not forbid the rebound after it.
  // Seeded from what the athlete has been running, or the block's first week would answer to nothing.
  let peakKm = band.baselineKm

  for (const week of draft.weeks) {
    const share = trainingWeekShare(week, availableWeekdays)
    if (share === 0) continue

    const floorKm = round(band.baselineKm * share * FLOOR_RATIO)
    const ceilingKm = round(band.capacityKm * share * CEILING_RATIO + CEILING_ALLOWANCE_KM)
    const km = weekKm(week)
    // Nothing carried a distance, or a duration with a pace: an under-specified week is frequency's business.
    if (km === 0) continue
    const judged = !adapting || km > (previousKm.get(week.startDate) ?? 0)

    const claimed = adapting ? null : focusContradictsPrescription(week, km)
    if (claimed !== null) {
      throw new Error(`Week ${week.startDate} says ${claimed} km in its focus but prescribes ${km} km; make the focus match the workouts`)
    }

    if (judged && km > ceilingKm) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km, beyond the ${ceilingKm} km this athlete has sustained; reduce it`)
    }

    const reduction = week.reducedVolume
    if (!adapting && km < floorKm && reduction === undefined) {
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

    if (judged) longestSession(week, km, share, band)

    if (judged && km > peakKm * RAMP_RATIO + RAMP_ALLOWANCE_KM) {
      throw new Error(`Week ${week.startDate} jumps from ${round(peakKm)} km to ${km} km; increase weekly volume gradually`)
    }

    peakKm = Math.max(peakKm, km)
  }
}

function round(km: number): number {
  return Math.round(km * 10) / 10
}
