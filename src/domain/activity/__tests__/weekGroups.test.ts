import { describe, it, expect } from 'vitest'
import { groupByWeek, weekStartOf, withCurrentWeek } from '../weekGroups'

// Thursday 24 September 2026 sits in the week of Monday the 21st.
const THIS_WEEK = '2026-09-21'
const run = (date: string, distanceKm = 10) => ({ date, distanceKm })

describe('weekStartOf', () => {
  it('keys every day of a week by its Monday', () => {
    expect(weekStartOf('2026-09-21')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-24')).toBe('2026-09-21')
    // Sunday closes the week that started six days earlier.
    expect(weekStartOf('2026-09-27')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28')
  })
})

describe('groupByWeek', () => {
  it('groups consecutive runs of one week and sums their distance', () => {
    const groups = groupByWeek([run('2026-09-24', 8), run('2026-09-22', 5), run('2026-09-19', 12)], THIS_WEEK)

    expect(groups.map((g) => [g.key, g.items.length, g.totalKm])).toEqual([
      ['2026-09-21', 2, 13],
      ['2026-09-14', 1, 12],
    ])
  })

  it('does not call last week current before this week has a run', () => {
    const groups = groupByWeek([run('2026-09-20'), run('2026-09-13')], THIS_WEEK)

    expect(groups.map((g) => g.isCurrent)).toEqual([false, false])
  })

  it('finds the current week by its date in an oldest-first list', () => {
    const groups = groupByWeek([run('2026-09-01'), run('2026-09-16'), run('2026-09-23')], THIS_WEEK)

    expect(groups.map((g) => g.isCurrent)).toEqual([false, false, true])
  })

  it('keeps the order it was given', () => {
    const newestFirst = groupByWeek([run('2026-09-23'), run('2026-09-16')], THIS_WEEK)
    const oldestFirst = groupByWeek([run('2026-09-16'), run('2026-09-23')], THIS_WEEK)

    expect(newestFirst.map((g) => g.key)).toEqual(['2026-09-21', '2026-09-14'])
    expect(oldestFirst.map((g) => g.key)).toEqual(['2026-09-14', '2026-09-21'])
  })
})

describe('withCurrentWeek', () => {
  it('opens a newest-first list on an empty current week before its first run', () => {
    const groups = withCurrentWeek(groupByWeek([run('2026-09-20', 25), run('2026-09-13')], THIS_WEEK), THIS_WEEK)

    expect(groups[0]).toEqual({ key: THIS_WEEK, items: [], totalKm: 0, isCurrent: true })
    expect(groups.slice(1).map((g) => [g.key, g.totalKm, g.isCurrent])).toEqual([
      ['2026-09-14', 25, false],
      ['2026-09-07', 10, false],
    ])
  })

  it('leaves a list that already holds the current week alone', () => {
    const groups = groupByWeek([run('2026-09-23'), run('2026-09-16')], THIS_WEEK)

    expect(withCurrentWeek(groups, THIS_WEEK)).toBe(groups)
  })

  it('stands in for the current week on an empty list too', () => {
    expect(withCurrentWeek([], THIS_WEEK)).toEqual([{ key: THIS_WEEK, items: [], totalKm: 0, isCurrent: true }])
  })
})
