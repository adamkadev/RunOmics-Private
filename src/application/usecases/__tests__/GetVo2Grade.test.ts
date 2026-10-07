import { describe, expect, it } from 'vitest'
import type { Vo2maxNorms } from '@/domain/athlete/vo2maxNorms'
import { buildVo2Grade, type Vo2GradeInput } from '../GetVo2Grade'

const T = { fair: 41.7, good: 45.4, excellent: 51.1, superior: 55.4 }
const NORMS = {
  male: { '20-29': T, '30-39': T, '40-49': T, '50-59': T, '60-69': T, '70-79': T },
  female: { '20-29': T, '30-39': T, '40-49': T, '50-59': T, '60-69': T, '70-79': T },
} as Vo2maxNorms

const everyOtherDay = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 2 * 86_400_000).toISOString().slice(0, 10))

function input(over: Partial<Vo2GradeInput>): Vo2GradeInput {
  const runs = everyOtherDay('2026-07-01', 40)
  return { age: 29, sex: 'male', value: 55, samples: [], hrRunDates: runs, runDates: runs, norms: NORMS, today: '2026-09-27', ...over }
}

describe('buildVo2Grade (v5.3)', () => {
  it('calibrates until 4 weeks and 12 runs with heart rate', () => {
    expect(buildVo2Grade(input({ hrRunDates: everyOtherDay('2026-09-10', 7) }))).toEqual({ status: 'calibrating', runs: 7, runsNeeded: 5, runsTarget: 12 })
  })

  it('grades the value on screen, with the gap to the next grade', () => {
    const view = buildVo2Grade(input({ samples: [{ date: '2026-08-01', vo2max: 54.8 }] }))
    expect(view).toMatchObject({ status: 'graded', grade: 'A', value: 55, floor: 54.5, next: { grade: 'A+', min: 55.4, gap: 0.4 }, band: { sex: 'male', bracket: '20-29' } })
  })

  it('reports a level-up for three days only, and never a steady grade', () => {
    const samples = [{ date: '2026-09-01', vo2max: 54.0 }, { date: '2026-09-18', vo2max: 54.8 }, { date: '2026-09-25', vo2max: 55.0 }]
    const day1 = buildVo2Grade(input({ samples, today: '2026-09-25' }))
    expect(day1.status === 'graded' && day1.change).toEqual({ kind: 'up', from: 'A−', date: '2026-09-25', regained: false })
    const day3 = buildVo2Grade(input({ samples, today: '2026-09-27' }))
    expect(day3.status === 'graded' && day3.change?.kind).toBe('up')
    const day4 = buildVo2Grade(input({ samples, today: '2026-09-28' }))
    expect(day4.status === 'graded' && day4.change).toBeNull()
  })

  // Oct 2026: A+ from April to Sep 12, A- then A through September, A+ again
  // on Oct 7 - which read "New grade, up from A".
  it('calls a grade that comes back after a dip regained, not new', () => {
    const samples = [
      { date: '2026-04-20', vo2max: 55.6 },
      { date: '2026-08-19', vo2max: 55.5 },
      { date: '2026-09-04', vo2max: 54.0 },
      { date: '2026-09-13', vo2max: 54.6 },
      { date: '2026-09-30', vo2max: 55.5 },
    ]
    const view = buildVo2Grade(input({ samples, value: 56.0, today: '2026-10-07' }))
    expect(view.status === 'graded' && view.change).toEqual({ kind: 'up', from: 'A', date: '2026-10-07', regained: true })
    // Every month of the season, the September dip included.
    expect(view.status === 'graded' && view.season.map((m) => m.grade).slice(3)).toEqual(['A+', 'A+', 'A+', 'A+', 'A+', 'A', 'A+'])
  })

  it('explains a drop by the days off before it, never as a level-up', () => {
    const runs = [...everyOtherDay('2026-07-01', 20), '2026-08-29', '2026-09-08']
    const samples = [{ date: '2026-08-01', vo2max: 55.0 }, { date: '2026-09-01', vo2max: 53.8 }, { date: '2026-09-09', vo2max: 53.8 }]
    const view = buildVo2Grade(input({ samples, value: 53.8, runDates: runs, today: '2026-09-12' }))
    expect(view.status === 'graded' && view.change).toEqual({ kind: 'down', from: 'A', date: '2026-09-09', daysOff: 9 })
  })

  it('has nothing above A+', () => {
    const view = buildVo2Grade(input({ value: 58 }))
    expect(view.status === 'graded' && [view.grade, view.next, view.etaWeeks]).toEqual(['A+', null, null])
  })

  it('drops the ETA while the value is still under a month ago, even if the last weeks lean up', () => {
    const samples = [{ date: '2026-08-20', vo2max: 55.4 }, { date: '2026-09-05', vo2max: 53.6 }, { date: '2026-09-20', vo2max: 54.6 }]
    const view = buildVo2Grade(input({ samples, value: 55.0 }))
    expect(view.status === 'graded' && [view.delta30, view.etaWeeks]).toEqual([-0.4, null])
  })
})
