import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'

const repos = vi.hoisted(() => ({
  latestDay: vi.fn((): TrainingStatusDay | null => null),
}))
vi.mock('@/infrastructure/repositories/JsonTrainingStatusRepository', () => ({ getLatestTrainingStatusDay: repos.latestDay }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => [
    { date: '2026-10-26', distanceKm: 10 },
    { date: '2026-10-20', distanceKm: 10 },
    { date: '2026-10-12', distanceKm: 10 },
    { date: '2026-10-05', distanceKm: 10 },
  ] as Activity[],
}))
vi.mock('../GetTrainingLoad', () => ({
  getTrainingLoad: async () => ({
    ctl: 40,
    atl: 42,
    tsb: -2,
    tsbNow: -2,
    points: Array.from({ length: 30 }, () => ({ ctl: 40, atl: 42, tsb: -2 })),
  }),
}))

const { getTrainingStatus } = await import('../GetTrainingStatus')

describe("getTrainingStatus with Garmin's status", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-27T12:00:00'), toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it("reads Garmin's status from the last three days", async () => {
    repos.latestDay.mockReturnValue({ date: '2026-10-24', status: 'overreaching', acwr: 1.6, acwrStatus: 'HIGH', chronicLoad: 500 })

    const status = await getTrainingStatus()

    expect(status).toMatchObject({ source: 'garmin', status: 'overreaching', risk: 'high', acwr: 1.6, chronicLoad: 500 })
  })

  it("falls back to the local estimate once Garmin's status is more than three days old", async () => {
    repos.latestDay.mockReturnValue({ date: '2026-10-23', status: 'overreaching', acwr: 1.6, acwrStatus: 'HIGH', chronicLoad: 500 })

    const status = await getTrainingStatus()

    expect(status).toMatchObject({ source: 'local', acwrStatus: null, chronicLoad: null })
    expect(status?.status).not.toBe('overreaching')
  })
})
