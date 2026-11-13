import { describe, expect, it, vi } from 'vitest'

const runs = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, date: new Date(Date.parse('2026-08-01T00:00:00Z') + i * 2 * 86_400_000).toISOString().slice(0, 10), avgHeartRate: 150 }))
const T = { fair: 41.7, good: 45.4, excellent: 51.1, superior: 55.4 }

vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => ({ age: 29, sex: 'male', vo2maxMlKgMin: 57 }) }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: () => runs }))
vi.mock('@/infrastructure/repositories/JsonVo2maxHistoryRepository', () => ({ getVo2maxSamples: () => ({ months: [], days: [{ date: '2026-11-12', vo2max: 57.4 }] }) }))
vi.mock('@/infrastructure/repositories/JsonVo2maxNormsRepository', () => ({ getVo2maxNorms: () => ({ male: { '20-29': T }, female: { '20-29': T } }) }))

const { getVo2Grade } = await import('../GetVo2Grade')

describe('getVo2Grade', () => {
  it('grades the precise daily VO2max the rest of the app shows, not the profile\'s whole number', () => {
    expect(getVo2Grade('2026-11-13')).toMatchObject({ status: 'graded', value: 57.4 })
  })
})
