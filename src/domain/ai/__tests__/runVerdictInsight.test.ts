import { describe, expect, it } from 'vitest'
import { runVerdictInsightHash } from '../runVerdictInsight'
import type { Activity, ActivityWeather } from '@/domain/activity/types'

const weather: ActivityWeather = {
  tempC: 16.4,
  apparentTempC: 14.2,
  humidityPct: 55,
  windKph: 10.4,
  windDirDeg: 304,
  precipitationMm: 0,
  code: 2,
}

const run = (overrides: Partial<Activity>): Activity =>
  ({
    date: '2026-06-14',
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 55 * 60,
    paceSecPerKm: 330,
    avgHeartRate: 148,
    rpe: null,
    aerTrainingEffect: null,
    elevationGain: null,
    avgTemperature: 22,
    weather: null,
    hrSamples: null,
    paceSamples: null,
    splits: null,
    ...overrides,
  }) as Activity

describe('runVerdictInsightHash weather cutoff', () => {
  it('leaves runs before the cutoff keyed on the watch sensor', () => {
    const old = { date: '2026-05-07' }

    expect(runVerdictInsightHash(run({ ...old, weather }))).toBe(
      runVerdictInsightHash(run({ ...old, weather: null }))
    )
  })

  it('rehashes a run before the cutoff when the watch reading changes', () => {
    expect(runVerdictInsightHash(run({ date: '2026-05-07', avgTemperature: 22 }))).not.toBe(
      runVerdictInsightHash(run({ date: '2026-05-07', avgTemperature: 18 }))
    )
  })

  it('keys runs from the cutoff onwards on the weather instead', () => {
    const recent = { date: '2026-05-08' }

    expect(runVerdictInsightHash(run({ ...recent, weather }))).not.toBe(
      runVerdictInsightHash(run({ ...recent, weather: null }))
    )
  })

  it('ignores the watch sensor from the cutoff onwards', () => {
    const recent = { date: '2026-05-08', weather }

    expect(runVerdictInsightHash(run({ ...recent, avgTemperature: 22 }))).toBe(
      runVerdictInsightHash(run({ ...recent, avgTemperature: 18 }))
    )
  })

  it('holds a recent run on the watch sensor until its conditions land', () => {
    const awaiting = { date: '2026-07-29', weather: null }

    expect(runVerdictInsightHash(run({ ...awaiting, avgTemperature: 22 }))).not.toBe(
      runVerdictInsightHash(run({ ...awaiting, avgTemperature: 18 }))
    )
  })

  it('rounds the apparent temperature so a decimal never rehashes a verdict', () => {
    expect(
      runVerdictInsightHash(run({ weather: { ...weather, apparentTempC: 14.2 } }))
    ).toBe(runVerdictInsightHash(run({ weather: { ...weather, apparentTempC: 14.4 } })))
  })
})
