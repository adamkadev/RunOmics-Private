import { describe, expect, it } from 'vitest'
import { detectSessionMoves, parseSessionMoves, withMovedSessions } from '../movedSessions'
import { plan } from './fixtures'

const entries = [
  { prescriptionId: 'workout-threshold', eventId: '101' },
  { prescriptionId: 'workout-easy', eventId: '102' },
]

const dateOf = (p: ReturnType<typeof plan>, id: string) => p.weeks.flatMap((week) => week.workouts).find((w) => w.id === id)?.date

describe('detectSessionMoves', () => {
  it('records a session whose calendar event sits on another day than the plan says', () => {
    const events = [{ id: '101', date: '2026-09-10' }, { id: '102', date: '2026-09-15' }]
    expect(detectSessionMoves(plan(), entries, events, {})).toEqual({ 'workout-threshold': '2026-09-10' })
  })

  it('drops a move once the event is back on the planned day', () => {
    const events = [{ id: '101', date: '2026-09-09' }]
    expect(detectSessionMoves(plan(), entries, events, { 'workout-threshold': '2026-09-10' })).toEqual({})
  })

  it('keeps an earlier move when the event is not listed', () => {
    expect(detectSessionMoves(plan(), entries, [], { 'workout-threshold': '2026-09-10' })).toEqual({ 'workout-threshold': '2026-09-10' })
  })

  it('ignores an event for a session the plan does not hold', () => {
    const events = [{ id: '103', date: '2026-09-11' }]
    expect(detectSessionMoves(plan(), [{ prescriptionId: 'gone', eventId: '103' }], events, {})).toEqual({})
  })
})

describe('withMovedSessions', () => {
  it('puts a moved session on its new day within its week', () => {
    const moved = withMovedSessions(plan(), { 'workout-threshold': '2026-09-10' })
    expect(dateOf(moved, 'workout-threshold')).toBe('2026-09-10')
    expect(dateOf(moved, 'workout-easy')).toBe('2026-09-15')
  })

  it('leaves a session moved out of its own week on its planned day', () => {
    expect(dateOf(withMovedSessions(plan(), { 'workout-threshold': '2026-09-14' }), 'workout-threshold')).toBe('2026-09-09')
  })

  it('returns the plan itself when nothing moved', () => {
    const p = plan()
    expect(withMovedSessions(p, { other: '2026-09-10' })).toBe(p)
  })
})

describe('parseSessionMoves', () => {
  it('keeps only ids mapped to a calendar date', () => {
    expect(parseSessionMoves({ moves: { a: '2026-09-10', b: 'soon', c: 3 } })).toEqual({ a: '2026-09-10' })
    expect(parseSessionMoves(null)).toEqual({})
  })
})
