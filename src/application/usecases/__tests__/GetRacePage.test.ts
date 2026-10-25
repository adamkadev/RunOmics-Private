import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { RacePredictionDay } from '@/infrastructure/repositories/JsonRacePredictionRepository'

const repos = vi.hoisted(() => ({
  races: vi.fn(),
  predictions: vi.fn((): RacePredictionDay[] => []),
  activities: vi.fn((): Activity[] => []),
}))
vi.mock('@/infrastructure/repositories/JsonUpcomingRaceRepository', () => ({ getUpcomingRaceYears: repos.races }))
vi.mock('@/infrastructure/repositories/JsonRacePredictionRepository', () => ({ getRacePredictionDays: repos.predictions }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities: repos.activities }))
vi.mock('@/infrastructure/repositories/JsonGoalRepository', () => ({ getGoalYears: () => [] }))
vi.mock('@/infrastructure/repositories/JsonPbRepository', () => ({ getPbYears: () => [] }))
vi.mock('@/infrastructure/repositories/JsonRaceResultRepository', () => ({ getOfficialRaceResults: () => [] }))

const { getRacePageData } = await import('../GetRacePage')

const TODAY = '2026-10-25'
const run = (id: string, date: string, bestEfforts: Record<string, number>) =>
  ({ id, date, type: 'Base', sport: 'running', description: '', distanceKm: 10, durationSeconds: 3000, bestEfforts }) as unknown as Activity

describe('getRacePageData', () => {
  beforeEach(() => {
    repos.races.mockReturnValue([{ year: 2026, races: [{ date: '2026-12-13', name: 'Winter 10K', distance: '10K' }] }])
    repos.activities.mockReturnValue([run('a', '2026-10-04', { '5k': 1500, '10k': 3200 }), run('b', '2026-06-01', { '5k': 1380 })])
  })

  it("keeps Garmin's prediction while its series is current", async () => {
    repos.predictions.mockReturnValue([{ date: '2026-10-23', '10k': 3050 }, { date: '2026-10-24', '10k': 3040 }])

    const data = await getRacePageData(TODAY)

    expect(data).toMatchObject({ predictedSeconds: 3040, estimate: null })
    expect(data!.trend.map((p) => p.seconds)).toEqual([3050, 3040])
  })

  it('estimates by VDOT from the best effort of the last 120 days once Garmin has gone quiet for a fortnight', async () => {
    repos.predictions.mockReturnValue([{ date: '2026-09-01', '10k': 2900 }, { date: '2026-09-02', '10k': 2890 }])

    const data = await getRacePageData(TODAY)

    expect(data!.estimate).toEqual({ effort: '5k', date: '2026-10-04', vdot: 38.3 })
    expect(data!.predictedSeconds).toBe(3113)
    expect(data!.trend.at(-1)).toEqual({ date: TODAY, seconds: 3113 })
    expect(data!.trend[0]!.seconds).toBeLessThan(3113)
  })
})
