import { describe, expect, it } from 'vitest'
import type { WeekTarget } from '@/domain/training/weekTarget'
import type { WorkoutBlock } from '@/domain/coaching/types'
import { t } from '@/i18n'
import { plannedSessionKinds, weekStripDays } from '../weekStrip'

const EASY: WorkoutBlock[] = [{ kind: 'effort', target: { distanceMeters: 8900 } }]
const STRIDES: WorkoutBlock[] = [
  { kind: 'effort', target: { distanceMeters: 8500 } },
  { kind: 'repeat', repetitions: 6, steps: [{ kind: 'strides', target: { durationSeconds: 20 } }] },
]

function coach(date: string, type: 'easy' | 'threshold' | 'long_run', blocks = EASY, state = 'prescribed') {
  return { state, prescription: { date, type, blocks } }
}

describe('plannedSessionKinds', () => {
  const k = t.dashboard.weeklyStreak.kinds

  it("names each day by the coach's session, strides included", () => {
    const kinds = plannedSessionKinds(
      ['2026-09-29', '2026-10-01', '2026-10-04'],
      [coach('2026-09-29', 'threshold'), coach('2026-10-01', 'easy', STRIDES), coach('2026-10-04', 'long_run')],
      [],
    )
    expect(kinds).toEqual({ '2026-09-29': k.threshold, '2026-10-01': k.easyStrides, '2026-10-04': k.long_run })
  })

  it("falls back to Garmin's type, and a cancelled prescription is no plan", () => {
    const kinds = plannedSessionKinds(
      ['2026-09-29', '2026-09-30'],
      [coach('2026-09-29', 'threshold', EASY, 'cancelled')],
      [{ date: '2026-09-29', type: 'Tempo' }],
    )
    expect(kinds).toEqual({ '2026-09-29': t.activityTypes.Tempo })
  })
})

describe('weekStripDays', () => {
  const days: WeekTarget['days'] = [
    { date: '2026-09-21', ranKm: 12.8, runs: 1, plannedKm: 13, plannedSessions: 1, type: 'Base', state: 'done' },
    { date: '2026-09-22', ranKm: 6.4, runs: 1, plannedKm: 10, plannedSessions: 1, type: 'Tempo', plannedType: 'Threshold', state: 'done' },
    { date: '2026-09-23', ranKm: 0, runs: 0, plannedKm: 9.2, plannedSessions: 1, type: 'Base', state: 'missed' },
    { date: '2026-09-24', ranKm: 0, runs: 0, plannedKm: null, plannedSessions: 0, state: 'rest' },
  ]
  const k = t.dashboard.weeklyStreak.kinds
  const kinds = { '2026-09-21': k.long_run, '2026-09-22': k.threshold, '2026-09-23': k.easy }

  it('writes run km on a run day, planned km on a day to come or missed, none on rest', () => {
    const strip = weekStripDays(days, '2026-09-24', kinds)
    expect(strip.map((d) => d.kmText)).toEqual(['12.8', '6.4', '9.2', null])
    expect(strip.map((d) => d.weekday)).toEqual(t.plan.weekdays.slice(0, 4))
    expect(strip.map((d) => d.letter)).toEqual(t.plan.weekdays.slice(0, 4).map((w) => w.charAt(0)))
  })

  it('names a day by its session, or by what was run when that differed', () => {
    const strip = weekStripDays(days, '2026-09-24', kinds)
    expect(strip.map((d) => d.kind)).toEqual(['Long run', t.activityTypes.Tempo, 'Easy', t.sessionState.rest])
    expect(strip[0]!.label).toContain('Long run')
    expect(strip[1]!.color).toBe('var(--zone-3)')
    expect(strip[3]!.isToday).toBe(true)
    expect(strip[3]!.label).toContain(t.sessionState.today)
  })
})
