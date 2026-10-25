import { describe, it, expect, vi } from 'vitest'
import { heatImpact, heatBandOf } from '../GetHeatImpact'
import { heatAhead } from '../GetHeatAhead'
import { usualRunHour } from '@/domain/activity/heatAhead'
import type { Activity, ActivityWeather } from '@/domain/activity/types'

const weather = (apparentTempC: number): ActivityWeather => ({
  tempC: apparentTempC,
  apparentTempC,
  humidityPct: 60,
  windKph: 5,
  windDirDeg: 180,
  precipitationMm: 0,
  code: 0,
})

const act = (overrides: Partial<Activity> = {}): Activity =>
  ({
    date: '2024-06-01',
    type: 'Base',
    distanceKm: 8,
    durationSeconds: 2400,
    paceSecPerKm: 300,
    avgHeartRate: 140,
    hrZones: [],
    weather: weather(10),
    ...overrides,
  }) as Activity

const runs = (count: number, overrides: Partial<Activity> = {}) =>
  Array.from({ length: count }, () => act(overrides))

describe('heatBandOf', () => {
  it('maps an apparent temperature onto its band', () => {
    expect(heatBandOf(-2)).toBe('cold')
    expect(heatBandOf(5)).toBe('cool')
    expect(heatBandOf(17)).toBe('mild')
    expect(heatBandOf(24)).toBe('warm')
    expect(heatBandOf(31)).toBe('hot')
  })
})

describe('heatImpact', () => {
  it('returns null when nothing qualifies', () => {
    expect(heatImpact([])).toBeNull()
    expect(heatImpact(runs(10, { weather: null }))).toBeNull()
  })

  it('returns null when a single band clears the minimum run count', () => {
    expect(heatImpact([...runs(10), ...runs(3, { weather: weather(30) })])).toBeNull()
  })

  it('prices each band as the pace it holds at the reference heart rate', () => {
    const data = heatImpact([...runs(10), ...runs(10, { paceSecPerKm: 330, weather: weather(30) })])!

    expect(data.refHeartRate).toBe(140)
    expect(data.bands.map((b) => b.id)).toEqual(['cool', 'hot'])
    expect(data.bands[0]!.paceAtRefHr).toBe(300)
    expect(data.bands[0]!.costSecPerKm).toBe(0)
    expect(data.bands[1]!.paceAtRefHr).toBe(330)
    expect(data.bands[1]!.costSecPerKm).toBe(30)
  })

  it('ignores workouts and runs shorter than 3km', () => {
    const polluted = [
      ...runs(10),
      ...runs(10, { paceSecPerKm: 330, weather: weather(30) }),
      ...runs(10, { type: 'VO2Max', paceSecPerKm: 200, weather: weather(30) }),
      ...runs(10, { distanceKm: 1, paceSecPerKm: 200, weather: weather(30) }),
    ]
    const data = heatImpact(polluted)!

    expect(data.bands.map((b) => b.runCount)).toEqual([10, 10])
    expect(data.bands[1]!.costSecPerKm).toBe(30)
  })
})

describe('heatAhead', () => {
  const evening = { startTimeLocal: '2026-07-01T18:10:00', route: [[6.17, 49.12]] as [number, number][] }
  const history = [
    ...runs(10, evening),
    ...runs(10, { ...evening, startTimeLocal: '2026-07-02T18:40:00', route: [[6.18, 49.11]], paceSecPerKm: 315, weather: weather(28) }),
  ]
  const at = (apparentTempC: number) => vi.fn(async () => [{ time: '2026-07-20T18:00', tempC: apparentTempC - 2, apparentTempC }])

  it('prices the forecast at the usual hour in what that heat has cost this athlete, asking with a coarse location', async () => {
    const forecast = at(28.4)
    expect(await heatAhead(history, '2026-07-20', undefined, forecast, 'Europe/Paris')).toEqual({ apparentTempC: 28, hour: 18, costSecPerKm: 15 })
    expect(forecast).toHaveBeenCalledWith(49.1, 6.2, '2026-07-20', 'Europe/Paris')
  })

  it('says nothing for a cool hour, a missing forecast, or heat it has too few runs in', async () => {
    expect(await heatAhead(history, '2026-07-20', undefined, at(17), 'Europe/Paris')).toBeNull()
    expect(await heatAhead(history, '2026-07-20', undefined, vi.fn(async () => null), 'Europe/Paris')).toBeNull()

    const unasked = at(30)
    expect(await heatAhead(runs(20, evening), '2026-07-20', undefined, unasked, 'Europe/Paris')).toBeNull()
    expect(unasked).not.toHaveBeenCalled()
  })

  it('takes the hour from the part of the day Garmin planned the run for', () => {
    const mixed = [...runs(3, { startTimeLocal: '2026-07-01T07:30:00' }), ...runs(5, { startTimeLocal: '2026-07-01T18:10:00' })]
    expect(usualRunHour(mixed)).toBe(18)
    expect(usualRunHour(mixed, 'Morning')).toBe(8)
    expect(usualRunHour(mixed, 'Afternoon')).toBe(14)
  })
})
