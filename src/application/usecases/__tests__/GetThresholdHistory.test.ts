import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ThresholdSample } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import type { AthleteHistoryEntry } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'

vi.mock('@/infrastructure/repositories/JsonThresholdHistoryRepository', () => ({
  getThresholdSamples: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/JsonAthleteHistoryRepository', () => ({
  getAthleteHistory: vi.fn(),
}))

async function run(samples: ThresholdSample[], athleteHistory: AthleteHistoryEntry[] = []) {
  const { getThresholdSamples } = await import('@/infrastructure/repositories/JsonThresholdHistoryRepository')
  const { getAthleteHistory } = await import('@/infrastructure/repositories/JsonAthleteHistoryRepository')
  vi.mocked(getThresholdSamples).mockReturnValue(samples)
  vi.mocked(getAthleteHistory).mockReturnValue(athleteHistory)

  const { getThresholdHistory } = await import('../GetThresholdHistory')
  return getThresholdHistory()
}

describe('getThresholdHistory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('null below the two points a trend needs', async () => {
    expect(await run([])).toBeNull()
    expect(await run([{ date: '2026-01-01', lthrBpm: 170 }])).toBeNull()
  })

  it('reports the most recent reading of each metric', async () => {
    const data = await run([
      { date: '2026-01-01', lthrBpm: 168, thresholdPaceSecPerKm: 260 },
      { date: '2026-03-01', lthrBpm: 172, thresholdPaceSecPerKm: 250 },
    ])

    expect(data?.latestLthr).toBe(172)
    expect(data?.latestPace).toBe(250)
    expect(data?.points).toHaveLength(2)
  })

  it('counts a faster threshold pace as a positive gain', async () => {
    const data = await run([
      { date: '2026-01-01', thresholdPaceSecPerKm: 260 },
      { date: '2026-03-01', thresholdPaceSecPerKm: 250 },
    ])

    expect(data?.paceGainSec).toBe(10)
  })

  it('counts a slower threshold pace as a negative gain', async () => {
    const data = await run([
      { date: '2026-01-01', thresholdPaceSecPerKm: 250 },
      { date: '2026-03-01', thresholdPaceSecPerKm: 262 },
    ])

    expect(data?.paceGainSec).toBe(-12)
  })

  it('leaves the gain null when only one revision carried a pace', async () => {
    const data = await run([
      { date: '2026-01-01', lthrBpm: 168 },
      { date: '2026-03-01', lthrBpm: 172, thresholdPaceSecPerKm: 250 },
    ])

    expect(data?.paceGainSec).toBeNull()
    expect(data?.latestPace).toBe(250)
  })

  it('carries a missing field through as null rather than dropping the revision', async () => {
    const data = await run([
      { date: '2026-01-01', lthrBpm: 168 },
      { date: '2026-03-01', thresholdPaceSecPerKm: 250 },
    ])

    expect(data?.points[0]).toMatchObject({ lthrBpm: 168, thresholdPaceSecPerKm: null })
    expect(data?.points[1]).toMatchObject({ lthrBpm: null, thresholdPaceSecPerKm: 250 })
    expect(data?.latestLthr).toBe(168)
  })

  it('falls back to the athlete change log when Garmin has no biometric history', async () => {
    const data = await run(
      [],
      [
        { date: '2026-01-01', lthrBpm: 165, weightKg: 70 },
        { date: '2026-02-01', thresholdPaceSecPerKm: 255 },
      ],
    )

    expect(data?.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-01'])
    expect(data?.latestLthr).toBe(165)
  })

  it('ignores change-log entries that carry no threshold metric', async () => {
    const data = await run(
      [],
      [
        { date: '2026-01-01', weightKg: 70 },
        { date: '2026-02-01', vo2maxMlKgMin: 52 },
        { date: '2026-03-01', lthrBpm: 165 },
      ],
    )

    expect(data).toBeNull()
  })

  it('prefers the Garmin samples over the change log when both exist', async () => {
    const data = await run(
      [
        { date: '2026-05-01', lthrBpm: 175 },
        { date: '2026-06-01', lthrBpm: 176 },
      ],
      [
        { date: '2020-01-01', lthrBpm: 150 },
        { date: '2020-02-01', lthrBpm: 151 },
      ],
    )

    expect(data?.points.map((p) => p.date)).toEqual(['2026-05-01', '2026-06-01'])
  })
})
