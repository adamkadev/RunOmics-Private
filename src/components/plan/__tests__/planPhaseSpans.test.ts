import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import type { PlanCoachingView } from '../planCoachingView'
import { generalBlockWeek, phaseWeek, planPhaseSpans, raceCountdown, spanOfWeek } from '../planPhaseSpans'

const GARMIN = [
  { phase: 'base' as const, startDate: '2026-09-08', endDate: '2026-09-28' },
  { phase: 'build' as const, startDate: '2026-09-29', endDate: '2026-10-19' },
]

function general(): PlanCoachingView {
  return { plan: { block: { startDate: '2026-10-12', endDate: '2026-11-08' }, macrocycleStartDate: '2026-10-08' }, workouts: [] }
}

describe('the plan’s phases', () => {
  it("reads Garmin's phases without coaching", () => {
    expect(planPhaseSpans(null, GARMIN).map((s) => s.name)).toEqual([t.plan.weekPurpose.planPhase.base, t.plan.weekPurpose.planPhase.build])
  })

  it('makes one general preparation phase of a block with no race, from its first Monday', () => {
    const [span, ...rest] = planPhaseSpans(general(), GARMIN)
    expect(rest).toEqual([])
    expect(span).toMatchObject({ name: t.plan.weekPurpose.generalPreparation, shortName: t.plan.phase.generalShort, startDate: '2026-10-05', endDate: '2026-11-08' })
  })
})

describe('the week in its phase', () => {
  it('counts the weeks of a phase that starts mid-week', () => {
    const spans = planPhaseSpans(null, GARMIN)
    expect(phaseWeek(spans, '2026-09-07')).toMatchObject({ week: 1, total: 3 })
    expect(phaseWeek(spans, '2026-09-21')).toMatchObject({ week: 3, total: 3 })
  })

  it('puts a week across two phases in the one holding most of it', () => {
    const spans = planPhaseSpans(null, GARMIN)
    // Mon Sep 28 is Base's last day; the rest of the week is Build.
    expect(spanOfWeek(spans, '2026-09-28')?.name).toBe(t.plan.weekPurpose.planPhase.build)
  })

  it('reads general preparation from its start to the block end', () => {
    expect(phaseWeek(planPhaseSpans(general(), []), '2026-10-19')).toMatchObject({ week: 3, total: 5 })
  })

  it('counts general preparation inside the block, not from the season start', () => {
    const { block } = general().plan
    const week = (monday: string) => generalBlockWeek(phaseWeek(planPhaseSpans(general(), []), monday), block, monday)
    expect(week('2026-10-12')).toMatchObject({ week: 1, total: 4 })
    expect(week('2026-11-02')).toMatchObject({ week: 4, total: 4 })
  })

  it('counts a midweek block from its first Monday, its part week a lead-in', () => {
    // Wed Oct 14 to Sun Nov 15: a lead-in, then four weeks.
    const block = { startDate: '2026-10-14', endDate: '2026-11-15' }
    const plan: PlanCoachingView = { plan: { block, macrocycleStartDate: '2026-10-14' }, workouts: [] }
    const week = (monday: string) => generalBlockWeek(phaseWeek(planPhaseSpans(plan, []), monday), block, monday)
    expect(week('2026-10-12')).toMatchObject({ week: 0, total: 4 })
    expect(week('2026-10-19')).toMatchObject({ week: 1, total: 4 })
    expect(week('2026-11-09')).toMatchObject({ week: 4, total: 4 })
  })

  it('leaves a race phase counted as it was', () => {
    const phase = phaseWeek(planPhaseSpans(null, GARMIN), '2026-09-21')
    expect(generalBlockWeek(phase, general().plan.block, '2026-09-21')).toBe(phase)
  })

  it('has no phase outside the plan', () => {
    expect(phaseWeek(planPhaseSpans(null, GARMIN), '2026-11-02')).toBeNull()
  })
})

describe('the race countdown', () => {
  it('counts weeks, then days, and nothing once the race is past', () => {
    expect(raceCountdown({ date: '2027-05-09', name: 'City Half', distance: 'Half-Marathon' }, '2026-10-19')).toBe(t.plan.phase.raceInWeeks(t.goals.half, 29))
    expect(raceCountdown({ date: '2026-10-22', name: '10 km', distance: '10K', location: 'Metz' }, '2026-10-19')).toBe(t.plan.phase.raceInDays('10K', 3))
    expect(raceCountdown({ date: '2026-10-18', name: '10K', distance: '10K' }, '2026-10-19')).toBeNull()
  })
})
