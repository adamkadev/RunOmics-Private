import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'
import { deltaSentence } from '../RunningDynamics'

const d = t.activity.dynamics

describe('deltaSentence', () => {
  // "+10 SLOWER": all caps, no unit, no reference point.
  it('writes the delta with its unit against the baseline', () => {
    expect(
      deltaSentence({ value: 256, band: { min: 231, median: 246, max: 260 }, decimals: 0, deltaUnit: 'ms', phrase: d.deltas.groundContact }, 8),
    ).toBe(`+10 ms ${d.deltas.groundContact.up}`)
  })

  // A marker at the track's edge read as a clipped bar.
  it('says so when the run sits at the edge of the baseline', () => {
    expect(
      deltaSentence({ value: 8.2, band: { min: 6.5, median: 7.7, max: 8.2 }, decimals: 1, deltaUnit: d.ratioUnit, phrase: d.deltas.verticalRatio }, 8),
    ).toBe(`+0.5 ${d.ratioUnit} ${d.deltas.verticalRatio.up} · ${d.atHigh(8)}`)
  })

  it('has nothing to say without a baseline', () => {
    expect(deltaSentence({ value: 1.4, band: null, decimals: 2, deltaUnit: 'm', phrase: d.deltas.strideLength }, 8)).toBeNull()
  })
})
