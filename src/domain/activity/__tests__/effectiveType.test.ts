import { describe, expect, it } from 'vitest'
import { effectiveType, type TypedSession } from '../effectiveType'

const easy = (date: string, activityId: string | null = null): TypedSession => ({
  prescription: { date, type: 'easy', status: 'prescribed' },
  activityId,
})

describe('effectiveType', () => {
  it('reads a guessed type as the session the run was set as', () => {
    const walkRun = { id: 'r1', date: '2026-10-25T09:12:00', type: 'VO2Max' as const, typeSource: 'runomics' as const }

    expect(effectiveType(walkRun, [easy('2026-10-25')])).toBe('Base')
    expect(effectiveType({ ...walkRun, date: '2026-10-24' }, [easy('2026-10-24', 'other'), easy('2026-10-25', 'r1')])).toBe('Base')
    expect(effectiveType(walkRun, [easy('2026-10-25'), easy('2026-10-25')])).toBe('VO2Max')
  })

  it('keeps the type Garmin measured', () => {
    const run = { id: 'r1', date: '2026-10-25', type: 'VO2Max' as const, typeSource: 'garmin' as const }

    expect(effectiveType(run, [easy('2026-10-25', 'r1')])).toBe('VO2Max')
  })
})
