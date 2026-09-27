import { describe, expect, it } from 'vitest'
import { sessionIntentOn } from '../sessionIntent'
import { plan, workout } from './fixtures'

describe('sessionIntentOn', () => {
  it("gives the coach's words for the session and its week", () => {
    expect(sessionIntentOn('2026-09-09T07:30:00', [plan()])).toEqual({
      title: '3 × 8 min threshold',
      description: 'Controlled threshold repetitions.',
      weekFocus: 'Threshold introduction',
    })
  })

  it('has nothing for a day no plan covers', () => {
    expect(sessionIntentOn('2026-08-01', [plan()])).toBeNull()
    expect(sessionIntentOn('2026-09-09', [])).toBeNull()
  })

  it('lets the newest plan over a day decide, even when it made the day a rest day', () => {
    const older = plan({ id: 'older' })
    const replanned = plan({
      id: 'current',
      weeks: [{ ...plan().weeks[0]!, focus: 'Rebuilt', workouts: [workout({ date: '2026-09-10', description: 'Moved a day.' })] }],
    })

    expect(sessionIntentOn('2026-09-10', [replanned, older])?.description).toBe('Moved a day.')
    expect(sessionIntentOn('2026-09-09', [replanned, older])).toBeNull()
    expect(sessionIntentOn('2026-09-15', [replanned, older])?.weekFocus).toBe('Aerobic support')
  })

  it('skips a cancelled session', () => {
    const cancelled = plan({ weeks: [{ ...plan().weeks[0]!, workouts: [workout({ status: 'cancelled' })] }] })

    expect(sessionIntentOn('2026-09-09', [cancelled])).toBeNull()
  })
})
