import { DAY_MS } from '@/lib/calendarDate'
import type { CoachState, CoachingPlan } from './types'

/** Conventional proportions: a rolling block regenerated toward the present needs them to tell a base block from a peak one. */
const SHAPE = { raceWeekDays: 7, base: 0.45, build: 0.35 } as const

export type MacrocyclePhase = 'base' | 'build' | 'peak' | 'raceDay'

/** The target id when no race is the target, so consecutive general blocks share one start date and a race marked primary opens a fresh run-up. */
export const GENERAL_PREPARATION = 'general'

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

export function phaseOn(ranges: MacrocyclePhaseRange[], date: string): MacrocyclePhase | null {
  return ranges.find((range) => date >= range.startDate && date <= range.endDate)?.phase ?? null
}

export function resolveMacrocycleStart(
  state: CoachState | null,
  primaryTargetId: string,
  planningStartDate: string,
): string {
  const carried = state?.macrocycle
  if (!carried || carried.targetEventId !== primaryTargetId) return planningStartDate
  // A block rewritten to start earlier moves the journey's start back with it: a macrocycle never starts after its block.
  return carried.startDate < planningStartDate ? carried.startDate : planningStartDate
}

export function macrocycleOf(plan: CoachingPlan): { targetEventId: string; startDate: string } {
  return {
    targetEventId: plan.targetEvent?.id ?? GENERAL_PREPARATION,
    startDate: plan.macrocycleStartDate ?? plan.block.startDate,
  }
}
