import { describe, expect, it } from 'vitest'
import { PLOT_HEIGHT, TOP_MARGIN, buildLanes, laneY, sampleAt, type ChartStackInput } from '../chartStackLanes'

const NONE: ChartStackInput = {
  distanceKm: 10,
  hrSamples: null,
  avgHr: null,
  paceSamples: null,
  avgPaceSecPerKm: null,
  cadenceSamples: null,
  avgCadence: null,
  elevationProfile: null,
  elevationGain: null,
}

describe('buildLanes', () => {
  it('stacks heart rate, pace, cadence and elevation in that order', () => {
    const lanes = buildLanes({
      ...NONE,
      hrSamples: [140, 150, 160],
      paceSamples: [300, 310, 305],
      cadenceSamples: [170, 172, 174],
      elevationProfile: [300, 305, 310],
    })

    expect(lanes.map((l) => l.key)).toEqual(['hr', 'pace', 'cadence', 'elevation'])
    expect(lanes.find((l) => l.key === 'pace')?.reversed).toBe(true)
  })

  it('lays each sample out along the distance', () => {
    const [hr] = buildLanes({ ...NONE, hrSamples: [140, 150, 160] })

    expect(hr?.data.map((p) => p.d)).toEqual([0, 5, 10])
    expect(hr?.data.map((p) => p.v)).toEqual(hr?.values)
  })

  it('leaves out a stream that is not there', () => {
    expect(buildLanes(NONE)).toEqual([])
  })
})

describe('laneY', () => {
  const lane = { domain: [100, 200] as [number, number], reversed: false }

  it('puts the top of the domain at the top of the plot and the bottom at its floor', () => {
    expect(laneY(lane, 200)).toBe(TOP_MARGIN)
    expect(laneY(lane, 100)).toBe(TOP_MARGIN + PLOT_HEIGHT)
    expect(laneY(lane, 150)).toBe(TOP_MARGIN + PLOT_HEIGHT / 2)
  })

  it('flips a reversed lane, where the smaller number is the higher point', () => {
    expect(laneY({ ...lane, reversed: true }, 100)).toBe(TOP_MARGIN)
    expect(laneY({ ...lane, reversed: true }, 200)).toBe(TOP_MARGIN + PLOT_HEIGHT)
  })
})

describe('sampleAt', () => {
  it('snaps to the nearest sample and reports its own distance', () => {
    expect(sampleAt([1, 2, 3, 4, 5], 0.49, 8)).toEqual({ km: 4, value: 3 })
  })
})
