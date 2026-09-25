import { describe, expect, it } from 'vitest'
import { loadSeries } from '../loadSeries'
import { ATL_DAYS, CTL_DAYS } from '../taper'

describe('loadSeries', () => {
  it('moves fitness and fatigue towards each day of load, form measured before it', () => {
    const series = loadSeries(new Map([['2026-07-01', 100]]), '2026-07-01', '2026-07-02')

    expect(series.get('2026-07-01')).toEqual({ load: 100, ctl: 100 / CTL_DAYS, atl: 100 / ATL_DAYS, tsb: 0 })
    const next = series.get('2026-07-02')!
    expect(next.load).toBe(0)
    expect(next.tsb).toBeCloseTo(100 / CTL_DAYS - 100 / ATL_DAYS)
    expect(next.ctl).toBeCloseTo((100 / CTL_DAYS) * (1 - 1 / CTL_DAYS))
  })

  it('has one entry per calendar day, rest days included, across a clock change', () => {
    // Europe's clocks went forward on 29 March 2026.
    const series = loadSeries(new Map([['2026-03-28', 50]]), '2026-03-27', '2026-03-31')

    expect([...series.keys()]).toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'])
  })

  it('is empty for a range that ends before it starts', () => {
    expect(loadSeries(new Map(), '2026-07-02', '2026-07-01').size).toBe(0)
  })
})
