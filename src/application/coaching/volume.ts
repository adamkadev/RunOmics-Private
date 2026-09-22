import type { BootstrapWeekDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { TrainingHistory } from '@/domain/training/trainingHistory'
import type { WorkoutBlock, WorkoutSegment } from '@/domain/coaching/types'

const FULL_WEEK_MS = 6 * 86_400_000
const FLOOR_RATIO = 0.8
const CEILING_RATIO = 1.05
// A percentage ceiling means nothing to someone returning on 5 km a week.
const CEILING_ALLOWANCE_KM = 3
const RAMP_RATIO = 1.12
const RAMP_ALLOWANCE_KM = 2
const FOCUS_TOLERANCE = 0.1

/** Wording that makes a week deliberately lighter, matching how frequency.ts lets a short week through. */
const DELIBERATELY_LIGHT = /recovery|taper|cutback|down week|fatigue|illness|injury|deload/i
const KM_IN_PROSE = /(\d+(?:[.,]\d+)?)\s*km/gi

/**
 * What this athlete is currently doing, and what they have shown they can hold.
 * A month of travel drags the 28-day mean far below both, so the floor follows
 * the more recent of the two and the ceiling follows the sustained one.
 */
export interface VolumeBand {
  baselineKm: number
  capacityKm: number
}

export function volumeBand(history: TrainingHistory): VolumeBand {
  const baselineKm = Math.max(history.recent7DaysKm, history.recentWeeklyAverageKm)
  return { baselineKm, capacityKm: Math.max(history.best4WeekAverageKm, baselineKm) }
}

function segments(blocks: WorkoutBlock[]): { segment: WorkoutSegment; repetitions: number }[] {
  return blocks.flatMap((block) => block.kind === 'repeat'
    ? block.steps.map((step) => ({ segment: step, repetitions: block.repetitions }))
    : [{ segment: block, repetitions: 1 }])
}

/**
 * Threshold work is usually prescribed by time, so a week counted from
 * `distanceMeters` alone can read 20 km lighter than it trains - which is how
 * a draft claiming 52 km came to prescribe 62.
 */
function segmentMeters(segment: WorkoutSegment): number {
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

function isFullWeek(week: BootstrapWeekDraft): boolean {
  return Date.parse(week.endDate) - Date.parse(week.startDate) === FULL_WEEK_MS
}

/** A week that names its own mileage and then prescribes another is the model losing count. */
function focusContradictsPrescription(week: BootstrapWeekDraft, km: number): number | null {
  for (const match of week.focus.matchAll(KM_IN_PROSE)) {
    const claimed = Number((match[1] ?? '').replace(',', '.'))
    if (claimed > 0 && Math.abs(claimed - km) / km > FOCUS_TOLERANCE) return claimed
  }
  return null
}

export function validateDraftVolume(draft: CoachingPlanDraft, band: VolumeBand): void {
  if (!(band.baselineKm > 0)) return

  const floorKm = round(band.baselineKm * FLOOR_RATIO)
  const ceilingKm = round(band.capacityKm * CEILING_RATIO + CEILING_ALLOWANCE_KM)
  let previousKm: number | null = null

  for (const week of draft.weeks) {
    if (!isFullWeek(week)) continue
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

    if (km < floorKm && !DELIBERATELY_LIGHT.test(week.focus)) {
      throw new Error(`Week ${week.startDate} prescribes ${km} km against a recent ${band.baselineKm} km; either build from that or name the recovery, taper or cutback reason in week.focus`)
    }

    if (previousKm !== null && km > previousKm * RAMP_RATIO + RAMP_ALLOWANCE_KM) {
      throw new Error(`Week ${week.startDate} jumps from ${previousKm} km to ${km} km; increase weekly volume gradually`)
    }

    previousKm = km
  }
}

function round(km: number): number {
  return Math.round(km * 10) / 10
}
