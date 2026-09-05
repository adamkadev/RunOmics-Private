import type { CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'

export function validateTrainingFrequency(days: number[], runs?: number): void {
  if (days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Invalid available weekday')
  if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > new Set(days).size)) {
    throw new Error('runsPerWeek must be an integer from 1 to the number of available weekdays')
  }
}

export function validateDraftFrequency(draft: CoachingPlanDraft, runs?: number): void {
  if (runs === undefined) return // Legacy callers have no explicit preference.
  for (const week of draft.weeks) {
    const count = week.workouts.length
    if (new Set(week.workouts.map(w => w.date)).size !== count) throw new Error('Bootstrap permits one run per day')
    if (count > runs) throw new Error('Weekly frequency exceeds runsPerWeek')
    const fullWeek = Date.parse(week.endDate) - Date.parse(week.startDate) === 6 * 86_400_000
    if (fullWeek && count < runs && !/fewer runs|reduced frequency|frequency reduction/i.test(week.focus)) {
      throw new Error('Fewer runs than runsPerWeek requires an explicit explanation in week.focus (fewer runs / reduced frequency)')
    }
    if (fullWeek && count < runs && !/recovery|taper|fatigue|illness|injury/i.test(week.focus)) {
      throw new Error('Reduced frequency requires a recovery/taper reason')
    }
  }
}
