import { describe, expect, it } from 'vitest'
import {
  garminMeasured,
  matchesEffortDistance,
  officialResultsByActivityId,
  resolvePerformance,
  type OfficialRaceResult,
} from '../raceResult'

const escherGarmin = { distanceKm: 5.25, durationSeconds: 1_310, paceSecPerKm: 249.5 }

const escherOfficial: OfficialRaceResult = {
  activityId: '24249913094',
  eventName: 'Escher Kulturlaf',
  date: '2026-09-05',
  distanceMeters: 5_000,
  chipTimeSeconds: 1_292,
  gunTimeSeconds: 1_293,
  overallPlace: 28,
  finisherCount: 188,
}

describe('resolvePerformance', () => {
  it('prefers the official result over the device measurement', () => {
    expect(resolvePerformance(escherGarmin, escherOfficial)).toEqual({
      source: 'official',
      distanceKm: 5,
      durationSeconds: 1_292,
      paceSecPerKm: 258.4,
      eventName: 'Escher Kulturlaf',
      overallPlace: 28,
      finisherCount: 188,
    })
  })

  it('falls back to the device measurement when no official result is linked', () => {
    expect(resolvePerformance(escherGarmin, null)).toEqual({
      source: 'garmin',
      distanceKm: 5.25,
      durationSeconds: 1_310,
      paceSecPerKm: 249.5,
    })
  })

  it('never rescales GPS distance against device time', () => {
    const performance = resolvePerformance(escherGarmin, escherOfficial)
    expect(performance.durationSeconds).toBe(escherOfficial.chipTimeSeconds)
    expect(performance.durationSeconds).not.toBe(escherGarmin.durationSeconds)
    expect(performance.distanceKm).toBe(5)
  })

  it('omits an absent placing rather than emitting a placeholder', () => {
    const { overallPlace, finisherCount, ...withoutPlacing } = escherOfficial
    expect([overallPlace, finisherCount]).toEqual([28, 188])

    const performance = resolvePerformance(escherGarmin, withoutPlacing)
    expect(performance).not.toHaveProperty('overallPlace')
    expect(performance).not.toHaveProperty('finisherCount')
  })

  it('carries the field size so a placing can be read in context', () => {
    expect(resolvePerformance(escherGarmin, escherOfficial).finisherCount).toBe(188)
  })

  it('keeps the raw device reading available alongside the official result', () => {
    expect(garminMeasured(escherGarmin)).toEqual(escherGarmin)
  })
})

describe('matchesEffortDistance', () => {
  it('matches the certified distance it was run over', () => {
    expect(matchesEffortDistance(escherOfficial, 5)).toBe(true)
  })

  it('does not match a different effort distance', () => {
    expect(matchesEffortDistance(escherOfficial, 10)).toBe(false)
    expect(matchesEffortDistance(escherOfficial, 1)).toBe(false)
  })

  it('tolerates rounding of odd certified distances', () => {
    const half = { ...escherOfficial, distanceMeters: 21_097 }
    expect(matchesEffortDistance(half, 21.0975)).toBe(true)
  })
})

describe('officialResultsByActivityId', () => {
  it('keys results by the activity they overlay', () => {
    expect(officialResultsByActivityId([escherOfficial]).get('24249913094')).toBe(escherOfficial)
  })

  it('is empty when no results are recorded', () => {
    expect(officialResultsByActivityId([]).size).toBe(0)
  })
})
