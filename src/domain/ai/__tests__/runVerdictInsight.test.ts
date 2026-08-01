import { describe, expect, it } from 'vitest'
import { deservesVerdict, isFreshRun, runVerdictInsightHash as hashContext } from '../runVerdictInsight'
import { runHistory } from '@/domain/activity/runHistory'
import type { Activity, ActivityWeather } from '@/domain/activity/types'

// The weather cutoff is a property of the run alone, so these hash it with the
// history a run with no past would carry.
const runVerdictInsightHash = (activity: Activity) =>
  hashContext({ activity, history: runHistory(activity, []), planned: null })

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
    hrZones: [],
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

describe('deservesVerdict', () => {
  const now = new Date('2026-07-30T10:00:00')
  const records = new Set(['pb-run'])

  it('covers a run recent enough to still be opened', () => {
    expect(deservesVerdict({ id: 'a', date: '2026-07-25' }, records, now)).toBe(true)
  })

  it('skips an old run nobody navigates back to', () => {
    expect(deservesVerdict({ id: 'a', date: '2026-01-10' }, records, now)).toBe(false)
  })

  it('still covers an old run that holds a record, since /records links to it', () => {
    expect(deservesVerdict({ id: 'pb-run', date: '2025-03-02' }, records, now)).toBe(true)
  })
})

describe('isFreshRun', () => {
  const now = new Date('2026-07-30T10:00:00')

  it('covers the run that just synced', () => {
    expect(isFreshRun({ date: '2026-07-30T06:12:00' }, now)).toBe(true)
  })

  // A run synced on one night only becomes generatable on the next, once the
  // deployment carrying it is live, so the window has to outlast a single day.
  it('still covers a run the sync only made visible the day after', () => {
    expect(isFreshRun({ date: '2026-07-28T06:12:00' }, now)).toBe(true)
  })

  it('leaves an older run to the backfill', () => {
    expect(isFreshRun({ date: '2026-07-20' }, now)).toBe(false)
  })
})
