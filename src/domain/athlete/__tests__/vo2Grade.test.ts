import { describe, expect, it } from 'vitest'
import type { Vo2maxNorms } from '../vo2maxNorms'
import {
  calibration,
  daysOffBefore,
  delta30,
  etaWeeks,
  gradeLadder,
  gradeOf,
  gradeTimeline,
  seasonMonths,
  trendSlope,
  vo2Grade,
} from '../vo2Grade'

const T = { fair: 41.7, good: 45.4, excellent: 51.1, superior: 55.4 }
const NORMS = {
  male: { '20-29': T, '30-39': T, '40-49': T, '50-59': T, '60-69': T, '70-79': T },
  female: { '20-29': T, '30-39': T, '40-49': T, '50-59': T, '60-69': T, '70-79': T },
} as Vo2maxNorms
const LADDER = gradeLadder(29, 'male', NORMS)

describe('gradeLadder (v5.3)', () => {
  it('starts each grade at its percentile of the age/sex norms, A+ first', () => {
    expect(LADDER.map((b) => [b.grade, b.min, b.topPercent])).toEqual([
      ['A+', 55.4, 5],
      ['A', 54.5, 8],
      ['A−', 53.4, 12],
      ['B+', 51.1, 20],
      ['B', 46.8, 35],
      ['B−', 42.6, 55],
      ['C', null, null],
    ])
    expect(LADDER[0]!.max).toBeNull()
    expect(LADDER[1]!.max).toBe(55.4)
  })

  it('grades a value by the floor it has reached', () => {
    expect(vo2Grade(55.0, 29, 'male', NORMS)).toBe('A')
    expect(gradeOf(55.4, LADDER)).toBe('A+')
    expect(gradeOf(54.44, LADDER)).toBe('A−')
    expect(gradeOf(30, LADDER)).toBe('C')
  })
})

describe('gradeTimeline: 7-day hysteresis', () => {
  const s = (date: string, vo2max: number) => ({ date, vo2max })

  it('does not flicker when the value crosses an edge and comes back within 7 days', () => {
    const timeline = gradeTimeline(
      [s('2026-09-01', 54.6), s('2026-09-03', 54.3), s('2026-09-05', 54.6), s('2026-09-08', 54.3), s('2026-09-10', 54.7)],
      LADDER,
      '2026-09-12',
    )
    expect(timeline.map((c) => c.grade)).toEqual(['A'])
  })

  it('changes once the value has stayed past the edge for 7 days', () => {
    const timeline = gradeTimeline([s('2026-09-01', 54.6), s('2026-09-03', 55.5), s('2026-09-06', 55.6), s('2026-09-10', 55.7)], LADDER, '2026-09-12')
    expect(timeline).toEqual([{ date: '2026-09-01', grade: 'A' }, { date: '2026-09-10', grade: 'A+' }])
  })

  it('confirms a value still past the edge today, 7 days on', () => {
    const timeline = gradeTimeline([s('2026-09-01', 54.6), s('2026-09-03', 55.5)], LADDER, '2026-09-10')
    expect(timeline.at(-1)).toEqual({ date: '2026-09-10', grade: 'A+' })
    expect(gradeTimeline([s('2026-09-01', 54.6), s('2026-09-03', 55.5)], LADDER, '2026-09-09').at(-1)?.grade).toBe('A')
  })
})

describe('trend, ETA and 30-day change', () => {
  const rising = Array.from({ length: 31 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, vo2max: 50 + i * 0.05 }))

  it('reads the 30-day change and the least-squares slope', () => {
    expect(delta30(rising)).toBe(1.5)
    expect(trendSlope(rising, '2026-08-31')).toBeCloseTo(0.05)
  })

  it('gives an ETA in weeks, hidden for a flat or falling trend or past 16 weeks', () => {
    expect(etaWeeks(53, 55, 0.05)).toBe(6)
    expect(etaWeeks(53, 55, 0)).toBeNull()
    expect(etaWeeks(53, 55, -0.1)).toBeNull()
    expect(etaWeeks(53, 55, 0.01)).toBeNull()
  })
})

describe('calibration', () => {
  it('needs 12 runs with heart rate over 4 weeks', () => {
    const days = (n: number, step: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 1) + i * step * 86_400_000).toISOString().slice(0, 10))
    expect(calibration(days(7, 3))).toEqual({ ready: false, runs: 7, runsNeeded: 5 })
    expect(calibration(days(12, 1)).ready).toBe(false)
    expect(calibration(days(12, 3)).ready).toBe(true)
  })
})

describe('drop reason and season', () => {
  it('names days off before a drop, and nothing for a normal week', () => {
    expect(daysOffBefore(['2026-08-20', '2026-08-31', '2026-09-01'], '2026-09-01')).toBe(10)
    expect(daysOffBefore(['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-16', '2026-08-18', '2026-08-20', '2026-08-22', '2026-08-24', '2026-08-26', '2026-08-28', '2026-08-30', '2026-09-01'], '2026-09-01')).toBeNull()
  })

  it('shows January, then every third month back from now', () => {
    expect(seasonMonths('2026-09-27')).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(seasonMonths('2026-01-10')).toEqual(['2026-01'])
  })
})
