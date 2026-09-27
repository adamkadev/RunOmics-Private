import { describe, expect, it } from 'vitest'
import { macrocycleWeek } from '@/components/coaching/presentation'
import { applyCoachDecision } from '../lifecycle'
import { macrocycleOf, macrocyclePhases, phaseOn, resolveMacrocycleStart } from '../macrocycle'
import type { CoachState, CoachingPlan } from '../types'
import { COACHING_SCHEMA_VERSION } from '../types'
import { parseCoachingPlan } from '../validation'
import { createdAt, keepDecision, plan, provenance, workout } from './fixtures'

const PRIMARY = 'race-1'
const MACROCYCLE_START = '2026-09-06'
const TARGET_DATE = '2026-11-29'

function state(overrides: Partial<CoachState> = {}): CoachState {
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    activePlanId: 'plan-1',
    activePlanRevision: 1,
    lastDecisionId: null,
    lastBootstrapAt: createdAt,
    lastPostActivityAt: null,
    lastWeeklyReviewAt: null,
    updatedAt: createdAt,
    ...overrides,
  }
}

function blockPlan(startDate: string, endDate: string, weekStarts: string[]): CoachingPlan {
  const base = plan()
  return parseCoachingPlan({
    ...base,
    macrocycleStartDate: MACROCYCLE_START,
    targetEvent: { ...base.targetEvent, id: PRIMARY, date: TARGET_DATE },
    block: { ...base.block, startDate, endDate },
    weeks: weekStarts.map((weekStart, i) => ({
      id: `week-${i + 1}`,
      index: i + 1,
      startDate: weekStart,
      endDate: new Date(Date.parse(weekStart + 'T00:00:00Z') + 6 * 86_400_000).toISOString().slice(0, 10),
      focus: 'Aerobic development',
      workouts: [workout({ id: `w-${i + 1}`, date: weekStart })],
    })),
  })
}

const FIRST_BLOCK = () => blockPlan('2026-09-06', '2026-10-03', ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
const NEXT_BLOCK = () => blockPlan('2026-10-04', '2026-10-31', ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'])

describe('macrocycle progress', () => {
  it('counts the first block from the start of training toward the target', () => {
    expect(macrocycleWeek(FIRST_BLOCK(), '2026-09-06')).toEqual({ done: 1, total: 12 })
  })

  it('does not reset when the next rolling block begins', () => {
    const next = NEXT_BLOCK()

    expect(next.block.startDate).toBe('2026-10-04')
    // Counted by the app's Mon-Sun week (v5.5 #8): Sunday Oct 4 closes week 4.
    expect(macrocycleWeek(next, '2026-10-04')).toEqual({ done: 4, total: 12 })
    expect(macrocycleWeek(next, '2026-10-05')).toEqual({ done: 5, total: 12 })
  })

  it('is unmoved by the rolling block boundaries themselves', () => {
    const shifted = blockPlan('2026-10-25', '2026-11-21', ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'])

    expect(shifted.macrocycleStartDate).toBe(MACROCYCLE_START)
    expect(macrocycleWeek(shifted, '2026-10-25')).toEqual({ done: 7, total: 12 })
    expect(macrocycleWeek(shifted, '2026-10-26')).toEqual({ done: 8, total: 12 })
  })
})

describe('resolveMacrocycleStart', () => {
  it('carries the journey forward while the primary target is unchanged', () => {
    const carried = state({ macrocycle: { targetEventId: PRIMARY, startDate: MACROCYCLE_START } })

    expect(resolveMacrocycleStart(carried, PRIMARY, '2026-10-04')).toBe(MACROCYCLE_START)
  })

  it('starts a new journey when the athlete targets a different race', () => {
    const carried = state({ macrocycle: { targetEventId: PRIMARY, startDate: MACROCYCLE_START } })

    expect(resolveMacrocycleStart(carried, 'other-race', '2026-10-04')).toBe('2026-10-04')
  })

  it('starts at the planning date when there is no journey yet', () => {
    expect(resolveMacrocycleStart(null, PRIMARY, '2026-09-06')).toBe('2026-09-06')
    expect(resolveMacrocycleStart(state(), PRIMARY, '2026-09-06')).toBe('2026-09-06')
  })

  it('anchors a legacy plan on its own block when persisting the journey', () => {
    const legacy = plan()

    expect(legacy.macrocycleStartDate).toBeUndefined()
    expect(macrocycleOf(legacy)).toEqual({ targetEventId: 'race-1', startDate: legacy.block.startDate })
  })
})

describe('macrocycle persistence', () => {
  it('survives a decision applied to the plan', () => {
    const current = FIRST_BLOCK()
    const decision = keepDecision({ planId: current.id, basePlanRevision: current.revision, resultPlanRevision: current.revision })

    expect(applyCoachDecision(current, decision).macrocycleStartDate).toBe(MACROCYCLE_START)
  })

  it('round-trips through validation', () => {
    expect(parseCoachingPlan(FIRST_BLOCK()).macrocycleStartDate).toBe(MACROCYCLE_START)
  })

  it('rejects a journey that starts after the block it contains', () => {
    const invalid = { ...FIRST_BLOCK(), macrocycleStartDate: '2026-09-20' }

    expect(() => parseCoachingPlan(invalid)).toThrow(/must not start after the training block/)
  })

  it('keeps legacy plans without the field valid and readable', () => {
    const legacy = { ...plan(), provenance: provenance() }
    delete (legacy as { macrocycleStartDate?: string }).macrocycleStartDate

    const parsed = parseCoachingPlan(legacy)
    expect(parsed.macrocycleStartDate).toBeUndefined()
    expect(macrocycleWeek(parsed, parsed.block.startDate)?.done).toBe(1)
  })
})

describe('macrocyclePhases', () => {
  it('divides the run-up and ends on the race', () => {
    expect(macrocyclePhases(MACROCYCLE_START, TARGET_DATE)).toEqual([
      { phase: 'base', startDate: '2026-09-06', endDate: '2026-10-10' },
      { phase: 'build', startDate: '2026-10-11', endDate: '2026-11-06' },
      { phase: 'peak', startDate: '2026-11-07', endDate: '2026-11-22' },
      { phase: 'raceDay', startDate: '2026-11-23', endDate: '2026-11-29' },
    ])
  })

  it('covers every day from the start to the race with no gap or overlap', () => {
    const ranges = macrocyclePhases(MACROCYCLE_START, TARGET_DATE)

    expect(ranges[0]!.startDate).toBe(MACROCYCLE_START)
    expect(ranges.at(-1)!.endDate).toBe(TARGET_DATE)
    for (let index = 1; index < ranges.length; index++) {
      const previousEnd = Date.parse(`${ranges[index - 1]!.endDate}T00:00:00Z`)
      const thisStart = Date.parse(`${ranges[index]!.startDate}T00:00:00Z`)
      expect(thisStart - previousEnd).toBe(86_400_000)
    }
  })

  it('says nothing when the run-up is too short to divide', () => {
    expect(macrocyclePhases('2026-11-20', TARGET_DATE)).toEqual([])
  })
})

describe('phaseOn', () => {
  const ranges = macrocyclePhases(MACROCYCLE_START, TARGET_DATE)

  it('places a rolling block that straddles a boundary', () => {
    // The block generated on 2026-09-23 opens in base and crosses into build
    // before it ends - which is exactly what the planner could not previously
    // be told.
    expect(phaseOn(ranges, '2026-09-23')).toBe('base')
    expect(phaseOn(ranges, '2026-10-05')).toBe('base')
    expect(phaseOn(ranges, '2026-10-12')).toBe('build')
  })

  it('reads the boundary days themselves', () => {
    expect(phaseOn(ranges, '2026-10-10')).toBe('base')
    expect(phaseOn(ranges, '2026-10-11')).toBe('build')
    expect(phaseOn(ranges, TARGET_DATE)).toBe('raceDay')
  })

  it('returns nothing outside the macrocycle', () => {
    expect(phaseOn(ranges, '2026-09-05')).toBeNull()
    expect(phaseOn(ranges, '2026-11-30')).toBeNull()
  })
})
