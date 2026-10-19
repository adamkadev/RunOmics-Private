import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { planPhaseLine } from '../planPhase'

const w = t.plan.weekPurpose

describe('planPhaseLine', () => {
  const block = { macrocycleStartDate: '2026-09-07', block: { startDate: '2026-09-07' }, targetEvent: { date: '2026-11-29' } }

  it('names the phase and the week of the block toward its race', () => {
    expect(planPhaseLine(block, [], '2026-09-09')).toEqual({ phase: w.planPhase.base, week: w.weekOfTarget(1, 12) })
    // Counted by the week's Monday, whichever day of it is asked.
    expect(planPhaseLine(block, [], '2026-11-08')).toEqual(planPhaseLine(block, [], '2026-11-02'))
    expect(planPhaseLine(block, [], '2026-11-02')!.week).toBe(w.weekOfTarget(9, 12))
  })

  it('names general preparation and counts its own weeks without a race', () => {
    const general = { macrocycleStartDate: '2026-10-12', block: { startDate: '2026-10-12' } }
    expect(planPhaseLine(general, [], '2026-10-21')).toEqual({ phase: w.generalPreparation, week: w.weekN(2) })
  })

  it("reads Garmin's phase ranges without coaching, and nothing outside them", () => {
    const ranges = [
      { phase: 'base' as const, startDate: '2026-08-01', endDate: '2026-09-06' },
      { phase: 'build' as const, startDate: '2026-09-07', endDate: '2026-10-04' },
    ]
    expect(planPhaseLine(null, ranges, '2026-09-09')).toEqual({ phase: w.planPhase.build, week: null })
    expect(planPhaseLine(null, ranges, '2026-07-15')).toEqual({ phase: w.prePlan, week: null })
    expect(planPhaseLine(null, [], '2026-09-09')).toBeNull()
  })
})
