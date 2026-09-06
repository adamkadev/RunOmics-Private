import { describe, expect, it } from 'vitest'
import { macrocycleWeek } from '@/components/coaching/presentation'
import { applyCoachDecision } from '../lifecycle'
import { macrocycleOf, resolveMacrocycleStart } from '../macrocycle'
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

/** A block of the given span, inside a macrocycle running to the primary target. */
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
    // Sep 6 -> Nov 29 is 12 weeks, and the block's own first week opens them.
    expect(macrocycleWeek(FIRST_BLOCK(), '2026-09-06')).toEqual({ done: 1, total: 12 })
  })

  it('does not reset when the next rolling block begins', () => {
    const next = NEXT_BLOCK()

    // The block restarted at Oct 4, the journey did not.
    expect(next.block.startDate).toBe('2026-10-04')
    expect(macrocycleWeek(next, '2026-10-04')).toEqual({ done: 5, total: 12 })
  })

  it('is unmoved by the rolling block boundaries themselves', () => {
    const shifted = blockPlan('2026-10-25', '2026-11-21', ['2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15'])

    expect(shifted.macrocycleStartDate).toBe(MACROCYCLE_START)
    expect(macrocycleWeek(shifted, '2026-10-25')).toEqual({ done: 8, total: 12 })
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
    // The UI falls back to the block, so the counter still reads.
    expect(macrocycleWeek(parsed, parsed.block.startDate)?.done).toBe(1)
  })
})
