import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { RacePredictionDay } from '@/infrastructure/repositories/JsonRacePredictionRepository'

const repos = vi.hoisted(() => ({
  predictions: vi.fn((): RacePredictionDay[] => []),
}))
vi.mock('@/infrastructure/repositories/JsonRacePredictionRepository', () => ({ getRacePredictionDays: repos.predictions }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => [
    { id: 'a', date: '2026-10-04', type: 'Base', sport: 'running', description: '', distanceKm: 10, durationSeconds: 3000, bestEfforts: { '5k': 1500, '10k': 3200 } },
  ] as unknown as Activity[],
}))
vi.mock('@/infrastructure/repositories/JsonPbRepository', () => ({ getPbYears: () => [] }))
vi.mock('@/infrastructure/repositories/JsonRaceResultRepository', () => ({ getOfficialRaceResults: () => [] }))
vi.mock('@/infrastructure/repositories/JsonAthleteRepository', () => ({ getAthleteProfile: () => ({}) }))

const { getRacePredictions } = await import('../GetRacePredictions')

const TODAY = '2026-10-27'

describe('getRacePredictions with Garmin predictions', () => {
  beforeEach(() => repos.predictions.mockReset())

  it("shows Garmin's 10K prediction while its series is current", async () => {
    repos.predictions.mockReturnValue([{ date: '2026-10-25', '10k': 3050 }, { date: '2026-10-26', '10k': 3040 }])

    const tenK = (await getRacePredictions(TODAY)).find((p) => p.key === '10k')

    expect(tenK).toMatchObject({ predictedSeconds: 3040, source: 'garmin' })
  })

  it('predicts from the records once Garmin has gone quiet for a fortnight', async () => {
    repos.predictions.mockReturnValue([{ date: '2026-09-01', '10k': 2900 }, { date: '2026-09-02', '10k': 2890 }])

    const tenK = (await getRacePredictions(TODAY)).find((p) => p.key === '10k')

    expect(tenK?.source).toBe('riegel')
    expect(tenK?.predictedSeconds).not.toBe(2890)
  })
})
