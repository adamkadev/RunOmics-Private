import { describe, expect, it } from 'vitest'
import type { GarminSyncState } from '../garminSyncState'
import { connectRetirementPlan, intervalsAthleteId, resolveWorkoutSyncRoute } from '../syncRoute'

describe('route choice', () => {
  it('takes intervals.icu when the profile has an API key', () => {
    expect(resolveWorkoutSyncRoute(undefined, { INTERVALS_API_KEY: 'k' })).toBe('intervals')
  })

  it('keeps Garmin Connect without one', () => {
    expect(resolveWorkoutSyncRoute(undefined, {})).toBe('connect')
    expect(resolveWorkoutSyncRoute(undefined, { INTERVALS_API_KEY: '  ' })).toBe('connect')
  })

  it('lets --route override the key', () => {
    expect(resolveWorkoutSyncRoute('connect', { INTERVALS_API_KEY: 'k' })).toBe('connect')
  })

  it('refuses --route intervals without a key, and an unknown route', () => {
    expect(() => resolveWorkoutSyncRoute('intervals', {})).toThrow(/INTERVALS_API_KEY/)
    expect(() => resolveWorkoutSyncRoute('strava', { INTERVALS_API_KEY: 'k' })).toThrow(/connect, intervals/)
  })

  it('addresses athlete 0 unless one is configured', () => {
    expect(intervalsAthleteId({})).toBe('0')
    expect(intervalsAthleteId({ INTERVALS_ATHLETE_ID: ' i42 ' })).toBe('i42')
  })
})

describe('handing over from Garmin Connect', () => {
  const entry = (prescriptionId: string, date: string) => ({
    prescriptionId,
    date,
    contentHash: 'h',
    garminWorkoutId: `w-${prescriptionId}`,
    garminWorkoutScheduleId: `s-${prescriptionId}`,
    status: 'scheduled' as const,
    lastSyncedAt: '2026-10-28T08:00:00.000Z',
  })
  const state: GarminSyncState = {
    schemaVersion: 1,
    planId: 'plan-1',
    updatedAt: null,
    entries: [entry('past', '2026-10-30'), entry('today', '2026-11-02'), entry('next', '2026-11-05')],
  }

  it('deletes RunOmics’s own Connect workouts from today on, and nothing else', () => {
    const retirement = connectRetirementPlan(state, '2026-11-02')

    expect(retirement.planId).toBe('plan-1')
    expect(retirement.operations.map((operation) => [operation.action, operation.existing?.garminWorkoutId])).toEqual([
      ['delete', 'w-today'],
      ['delete', 'w-next'],
    ])
  })
})
