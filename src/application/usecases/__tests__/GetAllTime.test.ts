import { describe, expect, it } from 'vitest'
import { allTimeView } from '../GetAllTime'

const run = (date: string, distanceKm: number, durationSeconds = 3600) => ({ id: `a-${date}`, date, distanceKm, durationSeconds })

const RUNS = [
  run('2025-05-03', 10),
  run('2025-05-20', 21.1, 6000),
  run('2025-12-30', 12),
  run('2026-04-20', 20),
  run('2026-04-22', 32),
  run('2026-09-24', 8.6),
]

describe('allTimeView', () => {
  it('totals everything since the first run', () => {
    const view = allTimeView(RUNS, '2026-09-26')
    expect(view).toMatchObject({ km: 104, runs: 6, since: '2025-05-03', months: 17, currentYear: 2026 })
  })

  it('gives one row per year with its km a month over the months it covers', () => {
    const view = allTimeView(RUNS, '2026-09-26')
    expect(view.years.map(({ year, km, runs, months, kmPerMonth }) => ({ year, km, runs, months, kmPerMonth }))).toEqual([
      { year: 2025, km: 43, runs: 3, months: 8, kmPerMonth: 5 },
      { year: 2026, km: 61, runs: 3, months: 9, kmPerMonth: 7 },
    ])
  })

  it('draws every month since the first, the current one partial, and names the best', () => {
    const view = allTimeView(RUNS, '2026-09-26')
    expect(view.monthly[0]).toMatchObject({ key: '2025-05', km: 31 })
    expect(view.monthly.at(-1)).toMatchObject({ key: '2026-09', partial: true })
    expect(view.monthly[0]!.projectedKm).toBeNull()
    expect(view.monthly.filter((m) => m.km === 0).length).toBeGreaterThan(0)
    expect(view.bestMonth).toMatchObject({ key: '2026-04', km: 52 })
  })

  it('finds the longest run and the biggest week', () => {
    const view = allTimeView(RUNS, '2026-09-26')
    expect(view.longestRun).toEqual({ km: 32, date: '2026-04-22', activityId: 'a-2026-04-22' })
    expect(view.biggestWeek).toEqual({ km: 52, weekStart: '2026-04-20' })
  })
})
