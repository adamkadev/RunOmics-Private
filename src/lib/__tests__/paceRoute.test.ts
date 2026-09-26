import { describe, expect, it } from 'vitest'
import { PACE_ROUTE_COLORS } from '@/lib/colors'
import { rgbTriplet } from '@/lib/palette'
import { DEFAULT_ROUTE_PACE, paceAtFraction, paceRouteColor } from '@/lib/paceRoute'

const rgb = (hex: string) => `rgb(${rgbTriplet(hex).join(',')})`

describe('paceRouteColor', () => {
  it('paints the ramp the Activity map paints, clamped at both ends', () => {
    expect(paceRouteColor(200)).toBe(rgb(PACE_ROUTE_COLORS.fast))
    expect(paceRouteColor(255)).toBe(rgb(PACE_ROUTE_COLORS.fast))
    expect(paceRouteColor(390)).toBe(rgb(PACE_ROUTE_COLORS.easy))
    expect(paceRouteColor(600)).toBe(rgb(PACE_ROUTE_COLORS.recovery))
  })

  it('mixes between two stops', () => {
    const [r1, g1, b1] = rgbTriplet(PACE_ROUTE_COLORS.steady)
    const [r2, g2, b2] = rgbTriplet(PACE_ROUTE_COLORS.easy)
    const mid = `rgb(${Math.round((r1 + r2) / 2)},${Math.round((g1 + g2) / 2)},${Math.round((b1 + b2) / 2)})`
    expect(paceRouteColor(370)).toBe(mid)
  })
})

describe('paceAtFraction', () => {
  it('reads the stream by the same share of its length', () => {
    expect(paceAtFraction([300, 400], 0)).toBe(300)
    expect(paceAtFraction([300, 400], 0.5)).toBe(350)
    expect(paceAtFraction([300, 400], 1)).toBe(400)
  })

  it('falls back to one even pace without a stream', () => {
    expect(paceAtFraction(null, 0.3)).toBe(DEFAULT_ROUTE_PACE)
    expect(paceAtFraction([280], 0.3)).toBe(DEFAULT_ROUTE_PACE)
  })
})
