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
})
