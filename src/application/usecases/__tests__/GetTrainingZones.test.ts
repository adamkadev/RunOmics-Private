import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({
  getAthleteProfile: vi.fn(),
}))

describe('getTrainingZones', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns null when the athlete has no threshold pace set', async () => {
    const { getAthleteProfile } = await import('@/infrastructure/repositories/JsonAthleteRepository')
    vi.mocked(getAthleteProfile).mockReturnValue({})

    const { getTrainingZones } = await import('../GetTrainingZones')
    expect(await getTrainingZones()).toBeNull()
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
    expect(threshold?.paceMinSecPerKm).toBe(Math.round(240 * 0.98))
    expect(threshold?.paceMaxSecPerKm).toBe(Math.round(240 * 1.02))
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
