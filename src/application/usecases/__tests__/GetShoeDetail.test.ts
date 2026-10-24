import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonShoeRepository', () => ({
  getShoeRegistry: () => ({
    daily: { name: 'Pegasus', brand: 'Nike', maxKm: 800, alertThresholdKm: 640, retired: false, dotColor: '#111' },
    old: { name: 'Clifton', brand: 'Hoka', maxKm: 700, alertThresholdKm: 560, retired: true, dotColor: '#222' },
  }),
}))

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getShoeDetail } = await import('../GetShoeDetail')

const NOW = new Date('2026-07-31T00:00:00Z')

const run = (gearId: string | undefined, date: string, distanceKm = 10): Activity =>
  ({ id: date, gearId, date, distanceKm }) as Activity

describe('getShoeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('null for a pair that is not in the registry', () => {
    getAllActivities.mockReturnValue([])

    expect(getShoeDetail('unknown')).toBeNull()
  })

  it('keeps only the runs done in that pair', () => {
    getAllActivities.mockReturnValue([
      run('daily', '2026-07-20'),
      run('old', '2026-07-19'),
      run(undefined, '2026-07-18'),
    ])

    expect(getShoeDetail('daily')?.activities.map((a) => a.date)).toEqual(['2026-07-20'])
  })

  it('lists those runs newest first', () => {
    getAllActivities.mockReturnValue([
      run('daily', '2026-06-01'),
      run('daily', '2026-07-20'),
      run('daily', '2026-07-01'),
    ])

    expect(getShoeDetail('daily')?.activities.map((a) => a.date)).toEqual([
      '2026-07-20',
      '2026-07-01',
      '2026-06-01',
    ])
  })

  it('totals the distance to a tenth of a kilometre', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20', 12.44), run('daily', '2026-07-18', 8.22)])

    expect(getShoeDetail('daily')?.totalKm).toBe(20.7)
  })

  it('dates the first outing from the oldest run, not the first in the list', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20'), run('daily', '2026-01-05')])

    expect(getShoeDetail('daily')?.firstUsedDate).toBe('2026-01-05')
  })

  it('averages the weekly mileage over the weeks between the first and most recent run, not weeks to today', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-06-03', 10), run('daily', '2026-07-01', 50)])

    // 28 days between the two runs = 4 weeks, over 60 km total.
    expect(getShoeDetail('daily')?.kmPerWeek).toBe(15)
  })

  it('counts a pair worn only once as a full week old rather than dividing by zero', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-31', 10)])

    expect(getShoeDetail('daily')?.kmPerWeek).toBe(10)
  })

  it('reports an unworn pair at zero rather than as missing', () => {
    getAllActivities.mockReturnValue([run('old', '2026-07-20')])

    expect(getShoeDetail('daily')).toMatchObject({
      totalKm: 0,
      firstUsedDate: null,
      kmPerWeek: 0,
      wearPercent: 0,
      activities: [],
    })
  })

  it('reads wear as a share of the stated lifespan', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-01', 200)])

    expect(getShoeDetail('daily')?.wearPercent).toBe(25)
  })

  it('treats a retired pair as fully worn whatever its mileage', () => {
    getAllActivities.mockReturnValue([run('old', '2026-07-01', 50)])

    expect(getShoeDetail('old')).toMatchObject({ retired: true, wearPercent: 100 })
  })

  it('carries the registry details through', () => {
    getAllActivities.mockReturnValue([])

    expect(getShoeDetail('daily')).toMatchObject({
      gearId: 'daily',
      name: 'Pegasus',
      brand: 'Nike',
      maxKm: 800,
      alertThresholdKm: 640,
      retired: false,
    })
  })

  it('splits the distance by session zone: base, tempo, threshold, intervals', () => {
    const typed = (type: Activity['type'], date: string, km: number) => ({ ...run('daily', date, km), type }) as Activity
    getAllActivities.mockReturnValue([
      typed('Base', '2026-07-01', 50),
      typed('Tempo', '2026-07-02', 20),
      typed('Threshold', '2026-07-03', 20),
      typed('VO2Max', '2026-07-04', 5),
      typed('Race', '2026-07-05', 5),
    ])

    expect(getShoeDetail('daily')!.typeShare).toEqual({ base: 50, tempo: 20, threshold: 20, intervals: 10 })
  })
})
