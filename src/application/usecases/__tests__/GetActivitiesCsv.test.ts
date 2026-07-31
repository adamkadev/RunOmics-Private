import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getActivitiesCsv } = await import('../GetActivitiesCsv')

const HEADER =
  'date,dayOfWeek,type,description,durationSeconds,distanceKm,paceSecPerKm,avgHeartRate,rpe,elevationGain,' +
  'aerTrainingEffect,anaTrainingEffect,calories,cadenceSpm,groundContactMs,verticalOscillationMm,' +
  'verticalRatioPct,strideLengthM,vo2maxGarmin,avgTemperature,comment'

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    date: '2026-07-20',
    dayOfWeek: 'Monday',
    type: 'Base',
    description: 'Morning run',
    durationSeconds: 3000,
    distanceKm: 10,
    paceSecPerKm: 300,
    avgHeartRate: 150,
    rpe: 4,
    elevationGain: 40,
    aerTrainingEffect: 3.1,
    anaTrainingEffect: 0.2,
    calories: 700,
    cadenceSpm: 172,
    groundContactMs: 248,
    verticalOscillationMm: 92,
    verticalRatioPct: 8.4,
    strideLengthM: 1.15,
    vo2maxGarmin: 54,
    avgTemperature: 21,
    comment: '',
    ...overrides,
  } as unknown as Activity
}

const rows = (csv: string) => csv.split('\n')

describe('getActivitiesCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes the header even with nothing to export', () => {
    getAllActivities.mockReturnValue([])
    expect(getActivitiesCsv()).toBe(HEADER)
  })

  it('writes one row per activity, in repository order', () => {
    getAllActivities.mockReturnValue([activity({ date: '2026-07-20' }), activity({ date: '2026-07-19' })])

    const lines = rows(getActivitiesCsv())
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(HEADER)
    expect(lines[1]?.startsWith('2026-07-20,')).toBe(true)
    expect(lines[2]?.startsWith('2026-07-19,')).toBe(true)
  })

  it('lays the columns out in the header order', () => {
    getAllActivities.mockReturnValue([activity()])

    expect(rows(getActivitiesCsv())[1]).toBe(
      '2026-07-20,Monday,Base,Morning run,3000,10,300,150,4,40,3.1,0.2,700,172,248,92,8.4,1.15,54,21,'
    )
  })

  it('quotes a value holding a comma', () => {
    getAllActivities.mockReturnValue([activity({ description: 'Tempo, then strides' })])

    expect(rows(getActivitiesCsv())[1]).toContain('"Tempo, then strides"')
  })

  it('doubles the quotes inside a quoted value', () => {
    getAllActivities.mockReturnValue([activity({ description: 'the "long" one, finally' })])

    expect(rows(getActivitiesCsv())[1]).toContain('"the ""long"" one, finally"')
  })

  it('quotes a value holding a line break rather than splitting the row', () => {
    getAllActivities.mockReturnValue([activity({ comment: 'felt flat\nknee sore' })])

    expect(getActivitiesCsv()).toContain('"felt flat\nknee sore"')
  })

  it('leaves a missing measurement empty instead of writing null', () => {
    getAllActivities.mockReturnValue([
      activity({ avgHeartRate: null, cadenceSpm: undefined, paceSecPerKm: null }),
    ])

    const cells = rows(getActivitiesCsv())[1]!.split(',')
    expect(cells[6]).toBe('')
    expect(cells[7]).toBe('')
    expect(cells[13]).toBe('')
  })

  it('keeps a zero, which is a reading rather than a gap', () => {
    getAllActivities.mockReturnValue([activity({ elevationGain: 0 })])

    expect(rows(getActivitiesCsv())[1]!.split(',')[9]).toBe('0')
  })
})
