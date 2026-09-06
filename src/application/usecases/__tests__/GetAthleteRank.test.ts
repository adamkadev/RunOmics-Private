import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RecordEntry } from '../GetRecords'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { Vo2maxNorms } from '@/domain/athlete/vo2maxNorms'

vi.mock('@/application/usecases/GetVO2maxHistory', () => ({
  getLatestVO2max: vi.fn(),
}))

async function rank(vo2maxGarmin: number | null, records: RecordEntry[], athlete: AthleteProfile) {
  const { getLatestVO2max } = await import('@/application/usecases/GetVO2maxHistory')
  vi.mocked(getLatestVO2max).mockReturnValue(vo2maxGarmin)
  const { getAthleteRank } = await import('../GetAthleteRank')
  return getAthleteRank(records, athlete, TEST_NORMS)
}

function record(key: string, seconds: number | null): RecordEntry {
  return { key, label: key, seconds, paceSecPerKm: null, activityId: 'a1', date: '2026-01-01', official: false }
}

const MALE_30 = { age: 34, sex: 'male' } as const
const MALE_30_NORMS = { fair: 40.5, good: 44, excellent: 48.3, superior: 54 }
const TEST_NORMS = {
  male: {
    '20-29': { fair: 41.7, good: 45.4, excellent: 51.1, superior: 55.4 },
    '30-39': MALE_30_NORMS,
    '60-69': { fair: 32.3, good: 35.5, excellent: 39.5, superior: 45.7 },
  },
  female: {
    '30-39': { fair: 34.4, good: 37.8, excellent: 42.4, superior: 47.4 },
  },
} as unknown as Vo2maxNorms

describe('getAthleteRank', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('null when neither a Garmin reading nor a race record is available', async () => {
    expect(await rank(null, [], MALE_30)).toBeNull()
    expect(await rank(null, [record('5k', null)], MALE_30)).toBeNull()
  })

  it('null without the age and sex the norms table is indexed by', async () => {
    expect(await rank(50, [], { sex: 'male' })).toBeNull()
    expect(await rank(50, [], { age: 34 })).toBeNull()
  })

  it('ranks off the Garmin reading alone when no race record qualifies', async () => {
    const result = await rank(MALE_30_NORMS.superior + 1, [], MALE_30)

    expect(result?.tier).toBe('S')
    expect(result?.vdot).toBeNull()
    expect(result?.vo2maxGarmin).toBe(Math.round(MALE_30_NORMS.superior + 1))
  })

  it('ranks off a race record alone when Garmin has no reading', async () => {
    const result = await rank(null, [record('5k', 20 * 60)], MALE_30)

    expect(result?.vo2maxGarmin).toBeNull()
    expect(result?.vdot).not.toBeNull()
    expect(result?.tier).not.toBe('D')
  })

  it('averages the Garmin reading and the best VDOT rather than taking either alone', async () => {
    const vdotOnly = await rank(null, [record('5k', 20 * 60)], MALE_30)
    expect(vdotOnly?.tier).toBe('A')
    expect(await rank(MALE_30_NORMS.superior, [], MALE_30)).toMatchObject({ tier: 'S' })

    const combined = await rank(MALE_30_NORMS.superior, [record('5k', 20 * 60)], MALE_30)

    expect(combined?.tier).toBe('A')
    expect(combined?.vo2maxGarmin).toBe(Math.round(MALE_30_NORMS.superior))
    expect(combined?.vdot).toBe(vdotOnly?.vdot)
  })

  it('keeps the best VDOT across distances, not the last one seen', async () => {
    const slowThenFast = await rank(null, [record('5k', 30 * 60), record('10k', 40 * 60)], MALE_30)
    const fastOnly = await rank(null, [record('10k', 40 * 60)], MALE_30)

    expect(slowThenFast?.vdot).toBe(fastOnly?.vdot)
  })

  it('ignores record keys that carry no VDOT distance', async () => {
    expect(await rank(null, [record('longest', 3 * 3600)], MALE_30)).toBeNull()
  })

  it('walks the D/C/B/A/S ladder as the score crosses each percentile anchor', async () => {
    const tierAt = async (vo2max: number) => (await rank(vo2max, [], MALE_30))?.tier

    expect(await tierAt(MALE_30_NORMS.fair - 1)).toBe('D')
    expect(await tierAt(MALE_30_NORMS.fair)).toBe('C')
    expect(await tierAt(MALE_30_NORMS.good)).toBe('B')
    expect(await tierAt(MALE_30_NORMS.excellent)).toBe('A')
    expect(await tierAt(MALE_30_NORMS.superior)).toBe('S')
  })

  it('grades the same reading against the athlete age bracket', async () => {
    const young = await rank(46, [], { age: 25, sex: 'male' })
    const older = await rank(46, [], { age: 65, sex: 'male' })

    expect(young?.tier).toBe('B')
    expect(older?.tier).toBe('S')
  })

  it('grades the same reading against the athlete sex', async () => {
    const male = await rank(44, [], { age: 34, sex: 'male' })
    const female = await rank(44, [], { age: 34, sex: 'female' })

    expect(male?.tier).toBe('B')
    expect(female?.tier).toBe('A')
  })
})
