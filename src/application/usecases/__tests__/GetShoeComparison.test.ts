import { describe, it, expect, vi } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonShoeRepository', () => ({
  getShoeRegistry: () => ({
    daily: { name: 'Daily', brand: 'Nike', maxKm: 1000, alertThresholdKm: 800, retired: false, dotColor: '#111' },
    race: { name: 'Race', brand: 'Adidas', maxKm: 800, alertThresholdKm: 640, retired: true, dotColor: '#222' },
  }),
}))

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getShoeComparison } = await import('../GetShoeComparison')

const run = (overrides: Partial<Activity>): Activity =>
  ({
    date: '2026-07-20T08:00:00',
    type: 'Base',
    distanceKm: 10,
    paceSecPerKm: 300,
    avgHeartRate: 150,
    cadenceSpm: 170,
    groundContactMs: 250,
    verticalOscillationMm: 90,
    ...overrides,
  }) as Activity

const many = (n: number, overrides: Partial<Activity>) =>
  Array.from({ length: n }, () => run(overrides))

describe('getShoeComparison', () => {
  it('averages each pair and totals its distance', () => {
    getAllActivities.mockReturnValue([
      ...many(3, { gearId: 'daily', paceSecPerKm: 300, avgHeartRate: 150 }),
      ...many(2, { gearId: 'daily', paceSecPerKm: 320, avgHeartRate: 160 }),
    ])

    const [daily] = getShoeComparison()

    expect(daily).toMatchObject({
      name: 'Daily',
      sessionCount: 5,
      totalKm: 50,
      paceSecPerKm: 308,
      avgHeartRate: 154,
    })
  })

  it('drops a pair with too few runs to average', () => {
    getAllActivities.mockReturnValue([...many(4, { gearId: 'daily' }), ...many(5, { gearId: 'race' })])

    expect(getShoeComparison().map((r) => r.name)).toEqual(['Race'])
  })

  it('ignores activities with no pair recorded', () => {
    getAllActivities.mockReturnValue([...many(5, { gearId: 'daily' }), ...many(5, { gearId: null })])

    expect(getShoeComparison()).toHaveLength(1)
  })

  it('reports the share of runs that were not easy base runs', () => {
    getAllActivities.mockReturnValue([
      ...many(3, { gearId: 'daily', type: 'Base' }),
      ...many(1, { gearId: 'daily', type: 'Tempo' }),
      ...many(1, { gearId: 'daily', type: 'Race' }),
    ])

    expect(getShoeComparison()[0]?.keySessionPercent).toBe(40)
  })

  it('spans the date range from oldest to newest run, given newest-first input', () => {
    getAllActivities.mockReturnValue([
      run({ gearId: 'daily', date: '2026-07-20T08:00:00' }),
      ...many(3, { gearId: 'daily', date: '2026-06-01T08:00:00' }),
      run({ gearId: 'daily', date: '2026-01-05T08:00:00' }),
    ])

    expect(getShoeComparison()[0]).toMatchObject({ firstUsed: '2026-01-05', lastUsed: '2026-07-20' })
  })

  it('sorts pairs by distance and keeps missing metrics null', () => {
    getAllActivities.mockReturnValue([
      ...many(5, { gearId: 'daily', distanceKm: 5 }),
      ...many(5, { gearId: 'race', distanceKm: 12, cadenceSpm: null }),
    ])

    const rows = getShoeComparison()

    expect(rows.map((r) => r.name)).toEqual(['Race', 'Daily'])
    expect(rows[0]?.cadenceSpm).toBeNull()
  })
})
