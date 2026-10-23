import { expect, it } from 'vitest'
import { validateDraftFrequency, validateTrainingFrequency } from '../frequency'
import type { CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
const draft = (count: number, focus = 'Aerobic development') => ({ weeks: [{ startDate: '2026-09-06', endDate: '2026-09-12', focus, workouts: ['2026-09-06', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-12'].slice(0, count).map(date => ({ date })) }] }) as CoachingPlanDraft
it('keeps desired frequency separate from availability and permits five runs', () => {
  expect(() => validateTrainingFrequency([0, 2, 3, 4, 6], 5)).not.toThrow()
  expect(() => validateTrainingFrequency([0, 2, 3, 4, 6], 3)).not.toThrow()
  expect(() => validateTrainingFrequency([0, 2, 4, 6], 5)).toThrow()
  expect(() => validateDraftFrequency(draft(5), 5)).not.toThrow()
  expect(() => validateDraftFrequency(draft(4), 5)).toThrow()
})
it('permits explained recovery and taper frequency reductions', () => {
  for (const reason of ['recovery', 'taper']) expect(() => validateDraftFrequency(draft(4, `Fewer runs for ${reason} after fatigue assessment`), 5)).not.toThrow()
})
it('reads a reduction explained in French', () => {
  for (const focus of ['Moins de sorties cette semaine : récupération après la course', 'Fréquence réduite pour l’affûtage', 'Moins de sorties à cause d’une blessure au mollet']) {
    expect(() => validateDraftFrequency(draft(4, focus), 5), focus).not.toThrow()
  }
  expect(() => validateDraftFrequency(draft(4, 'Moins de sorties cette semaine'), 5)).toThrow('recovery/taper reason')
  expect(() => validateDraftFrequency(draft(4, 'Semaine de récupération'), 5)).toThrow('explicit explanation')
})
