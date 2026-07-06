import { describe, it, expect } from 'vitest'
import { classifyProjectionVerdict, projectTsbSeries } from '../GetFormProjection'

describe('classifyProjectionVerdict', () => {
  it('build-more when tsb is very high and the target is far out', () => {
    expect(classifyProjectionVerdict(25, 14)).toBe('build-more')
  })

  it('peak-ready when tsb is high but the target is close (no time to add load)', () => {
    expect(classifyProjectionVerdict(25, 5)).toBe('peak-ready')
  })

  it('peak-ready in the 5-20 range', () => {
    expect(classifyProjectionVerdict(10, 14)).toBe('peak-ready')
  })

  it('ease-off when still fatigued', () => {
    expect(classifyProjectionVerdict(-5, 14)).toBe('ease-off')
  })

  it('on-track in the balanced middle', () => {
    expect(classifyProjectionVerdict(2, 14)).toBe('on-track')
  })
})

describe('projectTsbSeries', () => {
  const START = new Date('2026-06-01T00:00:00')

  it('produces one point per horizon day, dated sequentially from startDate', () => {
    const pts = projectTsbSeries(50, 40, START, 3, new Map())
    expect(pts).toHaveLength(3)
    expect(pts.map((p) => p.date)).toEqual(['2026-06-02', '2026-06-03', '2026-06-04'])
    expect(pts.every((p) => p.isProjected)).toBe(true)
  })

  it('with zero planned load, tsb rises toward ctl-atl=0 as both decay', () => {
    const pts = projectTsbSeries(50, 40, START, 5, new Map())
    // starts at 50-40=10, and each day's tsb should be non-decreasing as atl decays faster than ctl
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.tsb).toBeGreaterThanOrEqual(pts[i - 1]!.tsb)
    }
  })

  it('applies planned load on its scheduled date only', () => {
    const loadByDate = new Map([['2026-06-02', 100]])
    const withLoad = projectTsbSeries(50, 40, START, 3, loadByDate)
    const withoutLoad = projectTsbSeries(50, 40, START, 3, new Map())
    // Day 1 (2026-06-02) form is set before that day's own load is applied, so it's unaffected...
    expect(withLoad[0]!.tsb).toBe(withoutLoad[0]!.tsb)
    // ...but day 2 reflects the fatigue from day 1's load.
    expect(withLoad[1]!.tsb).toBeLessThan(withoutLoad[1]!.tsb)
  })

  it('a higher load multiplier produces more fatigue (lower tsb) than a lower one', () => {
    const loadByDate = new Map([['2026-06-02', 100], ['2026-06-03', 100]])
    const low = projectTsbSeries(50, 40, START, 4, loadByDate, 0.8)
    const high = projectTsbSeries(50, 40, START, 4, loadByDate, 1.2)
    expect(high[3]!.tsb).toBeLessThan(low[3]!.tsb)
  })
})
