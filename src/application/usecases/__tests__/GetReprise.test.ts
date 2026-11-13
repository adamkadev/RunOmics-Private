import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan } from '@/domain/coaching/types'
import { buildReprise } from '../GetReprise'

const BREAKS = [{ start: '2026-05-01', end: '2026-10-20', reason: 'injury' as const }]
const plan = (startDate: string, endDate: string) => ({ block: { id: startDate, name: 'Block', startDate, endDate, focus: '' } }) as CoachingPlan
const run = (date: string) => ({ id: date, date, sport: 'running', type: 'Base', distanceKm: 3 }) as Activity
const PLANS = [plan('2026-10-26', '2026-11-29'), plan('2026-11-30', '2026-12-27')]
const RUNS = [run('2026-04-20'), run('2026-10-28'), run('2026-11-01')]

describe('buildReprise', () => {
  it('holds through the first block after a long break, from the first run back', () => {
    expect(buildReprise(BREAKS, PLANS, RUNS, '2026-11-13')).toEqual({ since: '2026-10-28', breakStart: '2026-05-01', breakEnd: '2026-10-20' })
  })

  it('ends with that block, and is never on without a long break', () => {
    expect(buildReprise(BREAKS, PLANS, RUNS, '2026-12-01')).toBeNull()
    expect(buildReprise([], PLANS, RUNS, '2026-11-13')).toBeNull()
    expect(buildReprise([{ start: '2026-10-10', end: '2026-10-20', reason: 'illness' }], PLANS, RUNS, '2026-11-13')).toBeNull()
  })
})
