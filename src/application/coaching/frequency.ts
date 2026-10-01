import { DAY_MS } from '@/lib/calendarDate'
import type { CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'

export function validateTrainingFrequency(days: number[], runs?: number): void {
  if (days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Invalid available weekday')
  if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > new Set(days).size)) {
    throw new Error('runsPerWeek must be an integer from 1 to the number of available weekdays')
  }
}

// A French deployment's coach writes week.focus in French (COACHING_LANGUAGE_RULE).
const FEWER_RUNS = /fewer runs|reduced frequency|frequency reduction|moins de sorties|fréquence réduite|réduction de (?:la )?fréquence/i
const FEWER_RUNS_REASON = /recovery|taper|fatigue|illness|injury|récup|affûtage|maladie|blessure/i

export function validateDraftFrequency(draft: CoachingPlanDraft, runs?: number): void {
  if (runs === undefined) return
  for (const week of draft.weeks) {
    const count = week.workouts.length
    if (new Set(week.workouts.map(w => w.date)).size !== count) throw new Error('Bootstrap permits one run per day')
    if (count > runs) throw new Error('Weekly frequency exceeds runsPerWeek')
    const fullWeek = Date.parse(week.endDate) - Date.parse(week.startDate) === 6 * DAY_MS
    if (fullWeek && count < runs && !FEWER_RUNS.test(week.focus)) {
      throw new Error('Fewer runs than runsPerWeek requires an explicit explanation in week.focus (fewer runs / reduced frequency)')
    }
    if (fullWeek && count < runs && !FEWER_RUNS_REASON.test(week.focus)) {
      throw new Error('Reduced frequency requires a recovery/taper reason')
    }
  }
}
