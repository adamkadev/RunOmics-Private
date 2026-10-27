import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({
  getAthleteProfile: vi.fn(),
}))

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: vi.fn(() => []),
}))

vi.mock('@/infrastructure/repositories/JsonRaceResultRepository', () => ({
  getOfficialRaceResults: vi.fn(() => []),
}))

vi.mock('@/infrastructure/repositories/JsonAthleteHistoryRepository', () => ({
  getAthleteHistory: vi.fn(() => []),
}))

vi.mock('@/infrastructure/repositories/JsonThresholdHistoryRepository', () => ({
  getThresholdSamples: vi.fn(() => []),
}))

const RECENT_MILE = [
  { id: 'recent', date: '2026-10-13', type: 'Base', sport: 'running', bestEfforts: { '1k': 421.6, '1mile': 731.9 } },
] as unknown as Activity[]

describe('getTrainingZones', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null when the athlete has no threshold pace set and no recent effort to estimate one from', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({})

    const { getTrainingZones } = await import('../GetTrainingZones')
    expect(await getTrainingZones('2026-10-25')).toBeNull()
  })

  it('estimates threshold pace by VDOT from the best recent effort of a mile or more when the watch gives none', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({})
    vi.mocked(getAllActivities).mockReturnValue([
      { id: 'recent', date: '2026-10-13', type: 'Base', sport: 'running', bestEfforts: { '1k': 421.6, '1mile': 731.9 } },
      { id: 'old', date: '2026-02-03', type: 'Threshold', sport: 'running', bestEfforts: { '5k': 2190.2 } },
    ] as unknown as Activity[])

    const { getTrainingZones } = await import('../GetTrainingZones')
    const result = await getTrainingZones('2026-10-25')

    expect(result?.thresholdPaceSecPerKm).toBe(498)
    expect(result?.estimate).toMatchObject({ effort: '1mile', date: '2026-10-13', activityId: 'recent', vdot: 21.5 })
    expect(result?.zones).toHaveLength(4)
  })

  it('derives the 4 zones as a multiplier of threshold pace', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 240 })

    const { getTrainingZones } = await import('../GetTrainingZones')
    const result = await getTrainingZones()

    expect(result?.thresholdPaceSecPerKm).toBe(240)
    expect(result?.zones).toHaveLength(4)
    expect(result?.zones.map((z) => z.key)).toEqual(['easy', 'marathon', 'threshold', 'vo2max'])

    const threshold = result?.zones.find((z) => z.key === 'threshold')
    expect(threshold?.paceMinSecPerKm).toBe(Math.round(240 * 0.97))
    expect(threshold?.paceMaxSecPerKm).toBe(Math.round(240 * 1.03) - 1)
  })

  it.each([240, 263, 300, 331])('leaves no gap and no overlap between zones at a %i s threshold', async (threshold) => {
    const { paceZones } = await import('../GetTrainingZones')
    const zones = paceZones(threshold)
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i]!.paceMinSecPerKm).toBe(zones[i - 1]!.paceMaxSecPerKm + 1)
    }
    const at = zones.find((z) => z.key === 'threshold')!
    expect(threshold).toBeGreaterThanOrEqual(at.paceMinSecPerKm)
    expect(threshold).toBeLessThanOrEqual(at.paceMaxSecPerKm)
  })

  it('zones get progressively faster from easy to vo2max', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 300 })

    const { getTrainingZones } = await import('../GetTrainingZones')
    const result = await getTrainingZones()
    const byKey = Object.fromEntries(result!.zones.map((z) => [z.key, z]))

    expect(byKey.easy!.paceMinSecPerKm).toBeGreaterThan(byKey.marathon!.paceMinSecPerKm)
    expect(byKey.marathon!.paceMinSecPerKm).toBeGreaterThan(byKey.threshold!.paceMinSecPerKm)
    expect(byKey.threshold!.paceMinSecPerKm).toBeGreaterThan(byKey.vo2max!.paceMinSecPerKm)
  })

  it("keeps the watch's threshold pace for eight weeks after it last changed", async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    const { getThresholdSamples } = await import('@/infrastructure/repositories/JsonThresholdHistoryRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 280 })
    vi.mocked(getThresholdSamples).mockReturnValue([{ date: '2026-09-01', thresholdPaceSecPerKm: 280 }])

    const { getTrainingZones } = await import('../GetTrainingZones')
    const result = await getTrainingZones('2026-10-27')

    expect(result?.thresholdPaceSecPerKm).toBe(280)
    expect(result?.estimate).toBeUndefined()
  })

  it("estimates by VDOT once the watch's threshold pace is more than eight weeks old", async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    const { getThresholdSamples } = await import('@/infrastructure/repositories/JsonThresholdHistoryRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 280 })
    vi.mocked(getAllActivities).mockReturnValue(RECENT_MILE)
    vi.mocked(getThresholdSamples).mockReturnValue([{ date: '2026-08-31', thresholdPaceSecPerKm: 280 }])

    const { getTrainingZones } = await import('../GetTrainingZones')
    const result = await getTrainingZones('2026-10-27')

    expect(result?.thresholdPaceSecPerKm).toBe(498)
    expect(result?.estimate).toMatchObject({ effort: '1mile', date: '2026-10-13' })
  })

  it('does not count a weight change in the athlete history as a fresh threshold pace', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    const { getAllActivities } = await import('@/infrastructure/repositories/JsonActivityRepository')
    const { getAthleteHistory } = await import('@/infrastructure/repositories/JsonAthleteHistoryRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 280 })
    vi.mocked(getAllActivities).mockReturnValue(RECENT_MILE)
    vi.mocked(getAthleteHistory).mockReturnValue([
      { date: '2026-06-01', thresholdPaceSecPerKm: 280, weightKg: 70 },
      { date: '2026-10-20', thresholdPaceSecPerKm: 280, weightKg: 69 },
    ])

    const { getTrainingZones } = await import('../GetTrainingZones')
    expect((await getTrainingZones('2026-10-27'))?.estimate).toBeDefined()
  })

  it("keeps the watch's threshold pace when no history dates it", async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    const { getAthleteHistory } = await import('@/infrastructure/repositories/JsonAthleteHistoryRepository')
    const { getThresholdSamples } = await import('@/infrastructure/repositories/JsonThresholdHistoryRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({ thresholdPaceSecPerKm: 280 })
    vi.mocked(getAthleteHistory).mockReturnValue([])
    vi.mocked(getThresholdSamples).mockReturnValue([])

    const { getTrainingZones } = await import('../GetTrainingZones')
    expect((await getTrainingZones('2026-10-27'))?.thresholdPaceSecPerKm).toBe(280)
  })
})

describe('thresholdPaceSince', () => {
  it('dates the current pace from the sample where it took that value', async () => {
    const { thresholdPaceSince } = await import('../GetTrainingZones')
    const samples = [
      { date: '2026-03-01', thresholdPaceSecPerKm: 290 },
      { date: '2026-05-01', thresholdPaceSecPerKm: 280 },
      { date: '2026-07-01' },
      { date: '2026-09-01', thresholdPaceSecPerKm: 280 },
    ]
    expect(thresholdPaceSince(samples, 280)).toBe('2026-05-01')
  })

  it('gives null when the latest sample disagrees with the current pace', async () => {
    const { thresholdPaceSince } = await import('../GetTrainingZones')
    expect(thresholdPaceSince([{ date: '2026-05-01', thresholdPaceSecPerKm: 290 }], 280)).toBeNull()
  })
})
