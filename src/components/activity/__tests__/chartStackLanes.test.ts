import { describe, expect, it } from 'vitest'
import {
  LANE_HEIGHT,
  bandRect,
  buildLanes,
  chartZones,
  elapsedAt,
  kmTicksPath,
  laneY,
  linePath,
  niceDomain,
  sampleAt,
  type ChartStackInput,
} from '../chartStackLanes'
import { t } from '@/i18n'

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

  it('keeps the recorded line and a smoothed one of the same length', () => {
    const [hr] = buildLanes({ ...NONE, hrSamples: [140, 150, 160] })

    expect(hr?.values).toEqual([140, 150, 160])
    expect(hr?.smoothed).toHaveLength(3)
  })

  // Pace goes through a rolling median first.
  it('takes a GPS spike out of the smoothed pace, not the raw', () => {
    const pace = Array.from({ length: 40 }, (_, i) => (i === 20 ? 380 : 300))
    const [lane] = buildLanes({ ...NONE, paceSamples: pace })

    expect(Math.max(...lane!.values.filter((v): v is number => v !== null))).toBe(380)
    expect(Math.max(...lane!.smoothed.filter((v): v is number => v !== null))).toBe(300)
  })

  it('scales a lane in round steps from its smoothed line', () => {
    expect(niceDomain([126, 150, 167], 10, 30)).toEqual([120, 170])
    expect(niceDomain([150, 151], 10, 30)).toEqual([135, 165])
    expect(niceDomain([null], 10, 30)).toBeNull()
  })

  it('leaves out a stream that is not there', () => {
    expect(buildLanes(NONE)).toEqual([])
  })
})

describe('laneY', () => {
  const lane = { domain: [100, 200] as [number, number], reversed: false }

  it('puts the top of the domain near the top of the lane and the bottom near its floor', () => {
    expect(laneY(lane, 200)).toBe(4)
    expect(laneY(lane, 100)).toBe(LANE_HEIGHT - 4)
    expect(laneY(lane, 150)).toBe(LANE_HEIGHT / 2)
  })

  it('flips a reversed lane, where the smaller number is the higher point', () => {
    expect(laneY({ ...lane, reversed: true }, 100)).toBe(4)
    expect(laneY({ ...lane, reversed: true }, 200)).toBe(LANE_HEIGHT - 4)
  })

  it('clips a raw spike past the scale just inside the lane', () => {
    expect(laneY(lane, 400)).toBe(2)
    expect(laneY(lane, 0)).toBe(LANE_HEIGHT - 2)
  })
})

describe('the lane paths', () => {
  it('lifts the pen over a gap rather than drawing across it', () => {
    expect(linePath([1, 2, null, 4, 5], (v) => v)).toBe('M0.0 1.0 L250.0 2.0 M750.0 4.0 L1000.0 5.0')
  })

  it('ticks every whole km, not the start or the finish', () => {
    expect(kmTicksPath(2.5)).toBe('M400.0 0 L400.0 72 M800.0 0 L800.0 72')
    expect(kmTicksPath(3)).toBe('M333.3 0 L333.3 72 M666.7 0 L666.7 72')
  })
})

// The athlete's zones behind heart rate and pace, Z1-Z3 of an easy run.
describe('zone bands', () => {
  const zones = chartZones(
    [1, 2, 3, 4, 5].map((zone, i) => ({ zone, minBpm: [119, 147, 165, 175, 185][i]! })),
    null,
    [
      { hrZone: 5, paceMinSecPerKm: 226, paceMaxSecPerKm: 254 },
      { hrZone: 4, paceMinSecPerKm: 255, paceMaxSecPerKm: 270 },
      { hrZone: 3, paceMinSecPerKm: 271, paceMaxSecPerKm: 304 },
      { hrZone: 2, paceMinSecPerKm: 305, paceMaxSecPerKm: 384 },
    ],
  )

  it("bands heart rate with the run's own zones and pace with the athlete's, Z1 slower than easy", () => {
    const [hr, pace] = buildLanes({ ...NONE, hrSamples: [126, 150, 167], paceSamples: [300, 340, 400], zones })

    expect(hr!.bands.map((b) => [b.zone, b.from, b.to])).toEqual([
      [1, 119, 147], [2, 147, 165], [3, 165, 175], [4, 175, 185], [5, 185, Infinity],
    ])
    expect(pace!.bands.map((b) => [b.zone, b.from, b.to])).toEqual([
      [5, -Infinity, 255], [4, 255, 271], [3, 271, 305], [2, 305, 385], [1, 385, Infinity],
    ])
  })

  it('draws a band only where the lane reaches it, on the line\'s scale', () => {
    const lane = { domain: [120, 170] as [number, number], reversed: false }
    expect(bandRect(lane, { zone: 4, from: 175, to: 185 })).toBeNull()
    // Z3 runs past the top of the scale, so it fills the padding up there.
    expect(bandRect(lane, { zone: 3, from: 160, to: 175 })).toMatchObject({ top: 0, labelled: true })
    const z1 = bandRect(lane, { zone: 1, from: 119, to: 147 })!
    expect(z1.top).toBeCloseTo(33.44, 2)
    expect(z1.top + z1.height).toBeCloseTo(69.28, 2)
    // Pace's Z5 is everything faster: up from the top.
    const pace = { domain: [260, 420] as [number, number], reversed: true }
    expect(bandRect(pace, { zone: 5, from: -Infinity, to: 255 })).toMatchObject({ top: 0, labelled: false })
  })

  it("falls back to the athlete's heart-rate zones when the run has none", () => {
    expect(chartZones([], [120, 148, 165, 176, 185], null)).toEqual({ hrMinBpm: [120, 148, 165, 176, 185], pace: null })
    expect(chartZones([], null, null)).toBeNull()
  })
})

describe('sampleAt', () => {
  it('snaps to the nearest sample and reports its own distance', () => {
    expect(sampleAt([1, 2, 3, 4, 5], 0.49, 8)).toEqual({ km: 4, value: 3 })
  })
})

describe('lane summaries', () => {
  // An average from the activity and a best from the samples can disagree, the best reading slower.
  it("averages to the Overview's moving pace, and never prints a best slower than it", () => {
    const pace = [250, 240, 260, 245, 255, 250, 248, 252]
    const lane = (avgPaceSecPerKm: number) =>
      buildLanes({
        distanceKm: 2, hrSamples: null, avgHr: null, paceSamples: pace, avgPaceSecPerKm,
        cadenceSamples: null, avgCadence: null, elevationProfile: null, elevationGain: null,
      })[0]!

    const even = lane(230)
    expect(even.valueUnit).toBe(t.units.perKm)
    expect(even.reversed).toBe(true)
    expect(even.average).toBe(230)
    expect(even.summary).toBe(`${t.activity.charts.avg} 3:50`)

    const usual = lane(251)
    expect(usual.summary).toBe(`${t.activity.charts.avg} 4:11 · ${t.activity.charts.bestSmoothed} 4:00`)
  })

  it('reads the time into the run from the pace samples', () => {
    const lane = buildLanes({
      distanceKm: 2, hrSamples: null, avgHr: null, paceSamples: [300, 300, 300, 300, 300], avgPaceSecPerKm: null,
      cadenceSamples: null, avgCadence: null, elevationProfile: null, elevationGain: null,
    })[0]
    expect(elapsedAt(lane, 1, 2)).toBeCloseTo(600)
    expect(elapsedAt(lane, 0.5, 2)).toBeCloseTo(300)
    expect(elapsedAt(undefined, 0.5, 2)).toBeNull()
  })

  it('prints the stat row\'s average heart rate, in whole bpm', () => {
    const lane = buildLanes({
      distanceKm: 2, hrSamples: [110, 112, 114, 116, 120.2], avgHr: 115, paceSamples: null, avgPaceSecPerKm: null,
      cadenceSamples: null, avgCadence: null, elevationProfile: null, elevationGain: null,
    })[0]!
    expect(lane.summary).toBe(`${t.activity.charts.avg} 115 · ${t.activity.charts.max} 120`)
  })
})


describe('distanceAxis', () => {
  it('runs from 0 to the run distance, which carries the unit', async () => {
    const { distanceAxis } = await import('../chartAxis')
    const axis = distanceAxis(6.11)
    expect(axis.ticks).toEqual([0, 2, 4, 6.11])
    expect(axis.format(0)).toBe('0')
    expect(axis.format(6.11)).toBe(`6.1 ${t.units.km}`)
  })

  it('drops a round tick too close to the end', async () => {
    const { distanceAxis } = await import('../chartAxis')
    expect(distanceAxis(6.4).ticks).toEqual([0, 2, 4, 6.4])
    expect(distanceAxis(10.2).ticks).toEqual([0, 2, 4, 6, 8, 10.2])
  })
})
