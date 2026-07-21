import { describe, it, expect } from 'vitest'
import { weekPlanPhase } from '../weekPlanPhase'
import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'

// Mirrors the real plan: build ends 2026-08-05, peak runs to 2026-08-26.
const RANGES: PlanPhaseRange[] = [
  { phase: 'build', startDate: '2026-07-16', endDate: '2026-08-05' },
  { phase: 'peak', startDate: '2026-08-06', endDate: '2026-08-26' },
  { phase: 'taper', startDate: '2026-08-27', endDate: '2026-09-04' },
  { phase: 'raceDay', startDate: '2026-09-05', endDate: '2026-09-05' },
]

describe('weekPlanPhase', () => {
  it('names a week fully inside one phase', () => {
    const week = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']
    expect(weekPlanPhase(week, RANGES)).toBe('build')
  })

  it('names a week straddling a boundary by the majority of its days', () => {
    // Wed 08-05 is the last build day; Thu-Sun (4 days) are peak.
    const week = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']
    expect(weekPlanPhase(week, RANGES)).toBe('peak')
  })

  it('returns null for a week outside every known range', () => {
    const week = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07']
    expect(weekPlanPhase(week, RANGES)).toBeNull()
  })

  it('returns null with no ranges at all', () => {
    expect(weekPlanPhase(['2026-07-21'], [])).toBeNull()
  })
})
