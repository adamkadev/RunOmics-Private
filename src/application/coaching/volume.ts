import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import type { WorkoutBlock, WorkoutSegment } from '@/domain/coaching/types'

const DAY_MS = 86_400_000
// A non-taper week should hold what the athlete just ran; the tolerance is for
// rounding a week's sessions, not for easing off without saying so.
const FLOOR_RATIO = 0.95
const CEILING_RATIO = 1.05
// A percentage ceiling means nothing to someone returning on 5 km a week.
const CEILING_ALLOWANCE_KM = 3
const RAMP_RATIO = 1.12
const RAMP_ALLOWANCE_KM = 2
const FOCUS_TOLERANCE = 0.1
// A week claiming to be lighter has to actually be lighter. 10% below the
// block's peak is the smallest gap that cannot be rounding or a rest day.
const REDUCTION_MARGIN = 0.9
// Single-session distance against the recent longest run is the one bound in
// this file with a hazard ratio behind it, though from a single observational
// cohort - hence a step rather than a hard ceiling. The share is convention.
const LONG_RUN_STEP = 1.1
const LONG_RUN_SHARE = 0.3
// As with the ceiling, proportions police nothing worth policing at the bottom
// of the range: at 6 km a week the only sane long run is most of it, and 10%
// more than a 3 km longest run is 300 metres. Neither bound binds below this.
const LONG_RUN_ALLOWANCE_KM = 8

const KM_IN_PROSE = /(\d+(?:[.,]\d+)?)\s*km/gi

// recent7DaysKm is a rolling window, so a block regenerated on a Wednesday
// straddles two calendar weeks and can read well under the week the athlete
// last actually completed. While they are still running, that completed week
// is the better witness; after a gap it is history rather than capacity.
const COMPLETED_WEEK_STALE_DAYS = 3

/**
 * The last Monday-to-Sunday week the athlete finished, which weeklySeries
 * already carries - its final entry is the week in progress, so the one before
 * it is the last complete one.
 */
function lastCompletedWeekKm(history: TrainingHistory): number {
  const since = history.daysSinceLastRun
  if (since === null || since > COMPLETED_WEEK_STALE_DAYS) return 0
  const weeks = history.weeklySeries.km
  return weeks.length >= 2 ? weeks[weeks.length - 2]! : 0
}

/**
 * What this athlete is currently doing, and what they have shown they can hold.
 * A month of travel drags the 28-day mean far below both, so the floor follows
 * the most recent of the three and the ceiling follows the sustained one.
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
    // A month off the road leaves no recent long run to measure against, but
    // the tolerance built over the quarter has not vanished with it.
    longestRunKm: history.longestRunLast30DaysKm || history.longestRunLast90DaysKm,
  }
}

/** Flattened so a repeat group's steps are counted once per repetition. Shared with intensity.ts. */
export function segments(blocks: WorkoutBlock[]): { segment: WorkoutSegment; repetitions: number }[] {
  return blocks.flatMap((block) => block.kind === 'repeat'
    ? block.steps.map((step) => ({ segment: step, repetitions: block.repetitions }))
    : [{ segment: block, repetitions: 1 }])
}

/**
 * Threshold work is usually prescribed by time, so a week counted from
 * `distanceMeters` alone can read 20 km lighter than it trains - which is how
 * a draft claiming 52 km came to prescribe 62.
 */
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
 * How much of a normal training week this one can hold - counted in the days
 * this athlete actually runs, not calendar days. A block starting on a Tuesday
 * loses only a Monday, so for a Tue-Sun runner it is a whole week and must
 * carry a whole week's volume; measuring the span in days would excuse it.
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

/** A week that names its own mileage and then prescribes another is the model losing count. */
function focusContradictsPrescription(week: BootstrapWeekDraft, km: number): number | null {
  for (const match of week.focus.matchAll(KM_IN_PROSE)) {
    const claimed = Number((match[1] ?? '').replace(',', '.'))
    if (claimed > 0 && Math.abs(claimed - km) / km > FOCUS_TOLERANCE) return claimed
  }
  return null
}

/**
 * The week can be impeccable and still hide one run nobody has any business
 * doing: weekly totals are blind to how the kilometres are distributed. Two
 * bounds, whichever is tighter - what one run has recently been worth, and a
 * share of the week, because a long run is a session and not the plan.
 */
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

export function validateDraftVolume(
  draft: CoachingPlanDraft,
  band: VolumeBand,
  availableWeekdays: number[],
): void {
  if (!(band.baselineKm > 0)) return

  // The one week per block that may sit under the floor, and only after the
  // arithmetic below agrees it is genuinely reduced.
  let reducedWeek: string | null = null

  // Measured against the block's peak so far, not the week just gone: a real
  // cutback is 15-30% down, and comparing with the week before it would then
  // forbid the rebound that made the cutback worth taking. The ceiling still
  // caps how high any single week may reach.
  //
  // Seeded from what the athlete has actually been running, because otherwise
  // the block's first week answers to nothing: floor and ceiling leave a wide
  // gap, and a block regenerated every month would take the unchecked jump
  // twelve times a year.
  let peakKm = band.baselineKm

  for (const week of draft.weeks) {
    const share = trainingWeekShare(week, availableWeekdays)
    if (share === 0) continue

    const floorKm = round(band.baselineKm * share * FLOOR_RATIO)
    const ceilingKm = round(band.capacityKm * share * CEILING_RATIO + CEILING_ALLOWANCE_KM)
    const km = weekKm(week)
    // Nothing in the week carried a distance, or a duration with a pace to
    // turn into one. Judging it against a weekly figure would be inventing
    // one; an empty or under-specified week is frequency's business.
    if (km === 0) continue

    const claimed = focusContradictsPrescription(week, km)
    if (claimed !== null) {
      throw new Error(`Week ${week.startDate} says ${claimed} km in its focus but prescribes ${km} km; make the focus match the workouts`)
    }

    if (km > ceilingKm) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km, beyond the ${ceilingKm} km this athlete has sustained; reduce it`)
    }

    const reduction = week.reducedVolume
    if (km < floorKm && reduction === undefined) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km against a recent ${band.baselineKm} km; either build from that or set week.reducedVolume with the recovery, taper or cutback reason`)
    }

    // Declaring the reduction is not taking it. Compared at full-week scale so
    // a short opening week is not judged against a whole week's peak.
    if (reduction !== undefined) {
      if (reducedWeek !== null) {
        throw new Error(`Week ${week.startDate} is a second reduced week after ${reducedWeek}; a block gets one, so build this one or move the reduction`)
      }
      const allowedKm = round(peakKm * REDUCTION_MARGIN * share)
      if (km > allowedKm) {
        throw new Error(`Week ${week.startDate} calls itself ${reduction.reason} at ${km} km but the block peaks at ${round(peakKm)} km; a reduced week has to be at or under ${allowedKm} km`)
      }
      reducedWeek = week.startDate
    }

    longestSession(week, km, share, band)

    if (km > peakKm * RAMP_RATIO + RAMP_ALLOWANCE_KM) {
      throw new Error(`Week ${week.startDate} jumps from ${round(peakKm)} km to ${km} km; increase weekly volume gradually`)
    }

    peakKm = Math.max(peakKm, km)
  }
}

function round(km: number): number {
  return Math.round(km * 10) / 10
}
