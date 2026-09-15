import { describe, expect, it } from 'vitest'
import { windowPaceGain } from '@/components/analytics/ThresholdChart'
import type { ThresholdPoint } from '@/application/usecases/GetThresholdHistory'

function point(thresholdPaceSecPerKm: number | null): ThresholdPoint {
  return { date: '2026-01-01', label: '1 Jan', lthrBpm: null, thresholdPaceSecPerKm }
}

describe('windowPaceGain', () => {
  // The card used to read its gain off the whole series while plotting one
  // window, so it claimed a 56s improvement above a chart showing 13s.
  it('measures the window it is given, not the series it was sliced from', () => {
    const series = [point(331), point(300), point(288), point(275)]
    const window = series.slice(-2)

    expect(windowPaceGain(series)).toBe(56)
    expect(windowPaceGain(window)).toBe(13)
  })

  it('reports a slower window as a negative gain', () => {
    expect(windowPaceGain([point(275), point(288)])).toBe(-13)
  })

  it('ignores points with no pace reading', () => {
    expect(windowPaceGain([point(null), point(300), point(288), point(null)])).toBe(12)
  })

  it('returns null rather than a reading when the window holds fewer than two paces', () => {
    expect(windowPaceGain([point(300)])).toBeNull()
    expect(windowPaceGain([point(null), point(300)])).toBeNull()
    expect(windowPaceGain([])).toBeNull()
  })
})
