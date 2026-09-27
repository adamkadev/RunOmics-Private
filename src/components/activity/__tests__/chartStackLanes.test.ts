import { describe, expect, it } from 'vitest'
import { PLOT_HEIGHT, TOP_MARGIN, buildLanes, elapsedAt, laneY, sampleAt, type ChartStackInput } from '../chartStackLanes'
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

describe('lane summaries', () => {
  // Pace printed "avg 4:10 · best 4:14": the average came from the activity and
  // the best from the samples, so the best could read slower than the average.
  it("averages to the Overview's moving pace, and never prints a best slower than it", () => {
    const pace = [250, 240, 260, 245, 255, 250, 248, 252]
    const lane = (avgPaceSecPerKm: number) =>
      buildLanes({
        distanceKm: 2, hrSamples: null, avgHr: null, paceSamples: pace, avgPaceSecPerKm,
        cadenceSamples: null, avgCadence: null, elevationProfile: null, elevationGain: null,
      })[0]!

    const even = lane(230)
    expect(even.unit).toBe(t.units.perKm)
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

  // G10: Charts gave the average as 113 beside the stat row's 115.
  it('prints the stat row\'s average heart rate, in whole bpm', () => {
    const lane = buildLanes({
      distanceKm: 2, hrSamples: [110, 112, 114, 116, 120.2], avgHr: 115, paceSamples: null, avgPaceSecPerKm: null,
      cadenceSamples: null, avgCadence: null, elevationProfile: null, elevationGain: null,
    })[0]!
    expect(lane.summary).toBe(`${t.activity.charts.avg} 115 · ${t.activity.charts.max} 120`)
  })
})


describe('distanceAxis', () => {
  // R5: the axis had no 0 and no unit.
  it('runs from 0 to the run distance, which carries the unit', async () => {
    const { distanceAxis } = await import('../chartAxis')
    const axis = distanceAxis(6.11)
    expect(axis.ticks).toEqual([0, 2, 4, 6.11])
    expect(axis.format(0)).toBe('0')
    expect(axis.format(6.11)).toBe(`6.11 ${t.units.km}`)
  })

  it('drops a round tick too close to the end', async () => {
    const { distanceAxis } = await import('../chartAxis')
    expect(distanceAxis(6.4).ticks).toEqual([0, 2, 4, 6.4])
    expect(distanceAxis(10.2).ticks).toEqual([0, 2, 4, 6, 8, 10.2])
  })
})
