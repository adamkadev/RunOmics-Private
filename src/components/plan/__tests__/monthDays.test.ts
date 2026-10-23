import { describe, expect, it } from 'vitest'
import { monthDays } from '../monthDays'

const july = Array.from({ length: 31 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)
const states = (planned: string[], ran: string[], today = '2026-07-20', dates = july) => {
  const days = monthDays(dates, (d) => ran.includes(d), (d) => planned.includes(d), today)
  return (d: string) => days.get(d)
}

describe('monthDays', () => {
  it('reads a planned day that was run as done, and a run with nothing planned as extra', () => {
    const day = states(['2026-07-07'], ['2026-07-07', '2026-07-09'])
    expect(day('2026-07-07')).toEqual({ state: 'done' })
    expect(day('2026-07-09')).toEqual({ state: 'extra' })
    expect(day('2026-07-08')).toEqual({ state: 'rest' })
  })

  it('is never missed today or later, only once the day is past', () => {
    const day = states(['2026-07-12', '2026-07-20', '2026-07-21'], [])
    expect(day('2026-07-12')).toEqual({ state: 'missed' })
    expect(day('2026-07-20')).toEqual({ state: 'planned' })
    expect(day('2026-07-21')).toEqual({ state: 'planned' })
  })

  it('counts a run a day off its session as that session', () => {
    const day = states(['2026-07-14'], ['2026-07-15'])
    expect(day('2026-07-14')).toEqual({ state: 'done', ranOn: '2026-07-15' })
    expect(day('2026-07-15')).toEqual({ state: 'done', standsFor: '2026-07-14' })
  })

  it('lets one run stand for one session only, and never a run that had its own', () => {
    // Two sessions either side of one run: the earlier one takes it.
    const day = states(['2026-07-14', '2026-07-16'], ['2026-07-15'])
    expect(day('2026-07-14')).toEqual({ state: 'done', ranOn: '2026-07-15' })
    expect(day('2026-07-16')).toEqual({ state: 'missed' })
    // A run on a planned day is that day's, not its neighbour's.
    const own = states(['2026-07-14', '2026-07-15'], ['2026-07-15'])
    expect(own('2026-07-14')).toEqual({ state: 'missed' })
    expect(own('2026-07-15')).toEqual({ state: 'done' })
  })

  it('never matches a run that has not happened yet', () => {
    const day = states(['2026-07-19'], ['2026-07-21'], '2026-07-20')
    expect(day('2026-07-19')).toEqual({ state: 'missed' })
  })

  it('matches across the edge of the month, the same on both months', () => {
    const august = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`)
    const julyView = states(['2026-08-01'], ['2026-07-31'], '2026-08-10')
    const augustView = states(['2026-08-01'], ['2026-07-31'], '2026-08-10', august)
    expect(julyView('2026-07-31')).toEqual({ state: 'done', standsFor: '2026-08-01' })
    expect(augustView('2026-08-01')).toEqual({ state: 'done', ranOn: '2026-07-31' })
  })

  // July 2026 on the real data: 11 sessions not run, 5 runs on unplanned days,
  // none of them next to each other.
  it('reads July 2026 as the real data has it', () => {
    const planned = ['01', '02', '03', '04', '05', '07', '08', '09', '10', '11', '12', '14', '15', '16', '17', '18', '19', '21', '22', '23'].map((d) => `2026-07-${d}`)
    const ran = ['07', '09', '10', '11', '14', '16', '21', '22', '23', '25', '26', '28', '29', '31'].map((d) => `2026-07-${d}`)
    const days = monthDays(july, (d) => ran.includes(d), (d) => planned.includes(d), '2026-10-07')
    const count = (state: string) => [...days.values()].filter((d) => d.state === state).length
    expect([count('done'), count('missed'), count('extra')]).toEqual([9, 11, 5])
  })
})
