import { DAY_MS } from '@/lib/calendarDate'
import type { CoachState, CoachingPlan } from './types'

/**
 * The season's shape between the macrocycle start and the target race. The
 * proportions are convention - 45% base, 35% build, the rest peak, with the
 * last week to the race itself - but the block needs to know which of them it
 * sits in, because a rolling four-week block regenerated toward the present
 * otherwise has no way to tell a base block from a peak one.
 */
const SHAPE = { raceWeekDays: 7, base: 0.45, build: 0.35 } as const

export type MacrocyclePhase = 'base' | 'build' | 'peak' | 'raceDay'

export interface MacrocyclePhaseRange {
  phase: MacrocyclePhase
  startDate: string
  endDate: string
}

const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const addDays = (date: string, days: number): string =>
  new Date(utc(date) + days * DAY_MS).toISOString().slice(0, 10)

/** Empty when the run-up is too short to divide, which the caller must handle. */
export function macrocyclePhases(startDate: string, raceDate: string): MacrocyclePhaseRange[] {
  const total = Math.round((utc(raceDate) - utc(startDate)) / DAY_MS) + 1
  if (total < 14) return []

  const runUp = total - SHAPE.raceWeekDays
  const baseDays = Math.max(1, Math.round(runUp * SHAPE.base))
  const buildDays = Math.max(1, Math.round(runUp * SHAPE.build))
  const peakDays = runUp - baseDays - buildDays
  if (peakDays < 1) return []

  const spans: { phase: MacrocyclePhase; days: number }[] = [
    { phase: 'base', days: baseDays },
    { phase: 'build', days: buildDays },
    { phase: 'peak', days: peakDays },
    { phase: 'raceDay', days: SHAPE.raceWeekDays },
  ]

  let cursor = startDate
  return spans.map(({ phase, days }, index) => {
    const endDate = index === spans.length - 1 ? raceDate : addDays(cursor, days - 1)
    const range = { phase, startDate: cursor, endDate }
    cursor = addDays(cursor, days)
    return range
  })
}

/** Which phase a date falls in, or null outside the macrocycle entirely. */
export function phaseOn(ranges: MacrocyclePhaseRange[], date: string): MacrocyclePhase | null {
  return ranges.find((range) => date >= range.startDate && date <= range.endDate)?.phase ?? null
}

export function resolveMacrocycleStart(
  state: CoachState | null,
  primaryTargetId: string,
  planningStartDate: string,
): string {
  const carried = state?.macrocycle
  return carried && carried.targetEventId === primaryTargetId ? carried.startDate : planningStartDate
}

export function macrocycleOf(plan: CoachingPlan): { targetEventId: string; startDate: string } {
  return {
    targetEventId: plan.targetEvent.id,
    startDate: plan.macrocycleStartDate ?? plan.block.startDate,
  }
}
