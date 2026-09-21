import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getLifetimeStats } = await import('../GetLifetimeStats')

const activity = (date: string, distanceKm = 10): Activity => ({ date, distanceKm }) as Activity

describe('getLifetimeStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null before there is any history', () => {
    getAllActivities.mockReturnValue([])
    expect(getLifetimeStats()).toBeNull()
  })

  it('counts every run and its distance', () => {
    getAllActivities.mockReturnValue([activity('2026-01-01', 12.4), activity('2025-01-01', 8.2)])

    const stats = getLifetimeStats()
    expect(stats?.totalActivities).toBe(2)
    expect(stats?.totalDistanceKm).toBe(20.6)
  })

  it('spans the first day to the last, whatever order they come in', () => {
    getAllActivities.mockReturnValue([activity('2025-01-01'), activity('2023-01-01'), activity('2024-06-01')])

    expect(getLifetimeStats()?.yearsTracked).toBe(2)
  })

  it('reads the same span from a list running the other way', () => {
    const dates = ['2023-01-01', '2024-06-01', '2025-01-01']
    getAllActivities.mockReturnValue(dates.map((d) => activity(d)))
    const forwards = getLifetimeStats()

    getAllActivities.mockReturnValue([...dates].reverse().map((d) => activity(d)))
    expect(getLifetimeStats()).toEqual(forwards)
  })

  it('reports a fraction of a year to one decimal', () => {
    getAllActivities.mockReturnValue([activity('2026-01-01'), activity('2026-07-02')])

    expect(getLifetimeStats()?.yearsTracked).toBe(0.5)
  })

  it('tracks zero years from a single day of running', () => {
    getAllActivities.mockReturnValue([activity('2026-07-20', 5)])

    expect(getLifetimeStats()).toEqual({ yearsTracked: 0, totalDistanceKm: 5, totalActivities: 1 })
  })

  it('rounds the total distance to a tenth of a kilometre', () => {
    getAllActivities.mockReturnValue([activity('2026-01-01', 10.06), activity('2026-01-02', 5.01)])

    expect(getLifetimeStats()?.totalDistanceKm).toBe(15.1)
  })
})
