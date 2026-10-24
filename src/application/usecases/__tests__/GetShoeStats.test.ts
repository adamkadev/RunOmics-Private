import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

vi.mock('@/infrastructure/repositories/JsonShoeRepository', () => ({
  getShoeRegistry: () => ({
    daily: { name: 'Pegasus', brand: 'Nike', maxKm: 800, alertThresholdKm: 640, retired: false, dotColor: '#111' },
    tempo: { name: 'Endorphin', brand: 'Saucony', maxKm: 600, alertThresholdKm: 480, retired: false, dotColor: '#222' },
    old: { name: 'Clifton', brand: 'Hoka', maxKm: 700, alertThresholdKm: 560, retired: true, dotColor: '#333' },
  }),
}))

const { getAllActivities } = vi.hoisted(() => ({ getAllActivities: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({ getAllActivities }))

const { getShoeStats } = await import('../GetShoeStats')

const run = (gearId: string | undefined, date: string, distanceKm = 10): Activity =>
  ({ gearId, date, distanceKm }) as Activity

const byId = (gearId: string) => getShoeStats().find((s) => s.gearId === gearId)

describe('getShoeStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('totals the distance and the sessions logged on each pair', () => {
    getAllActivities.mockReturnValue([
      run('daily', '2026-07-20', 12.5),
      run('daily', '2026-07-18', 8.3),
      run('tempo', '2026-07-19', 14),
    ])

    expect(byId('daily')?.totalKm).toBe(20.8)
    expect(byId('daily')?.sessionCount).toBe(2)
    expect(byId('tempo')?.sessionCount).toBe(1)
  })

  it('takes the last outing from the newest run in the list', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20'), run('daily', '2026-01-05')])

    expect(byId('daily')?.lastUsedDate).toBe('2026-07-20')
  })

  it('lists a pair that has never been worn, at zero', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20')])

    expect(byId('tempo')).toMatchObject({ totalKm: 0, sessionCount: 0, lastUsedDate: null, wearPercent: 0 })
  })

  it('ignores runs logged without a pair', () => {
    getAllActivities.mockReturnValue([run(undefined, '2026-07-20', 15)])

    expect(getShoeStats().every((s) => s.totalKm === 0)).toBe(true)
  })

  it('carries the registry details of each pair through', () => {
    getAllActivities.mockReturnValue([])

    expect(byId('daily')).toMatchObject({ name: 'Pegasus', brand: 'Nike', maxKm: 800, alertThresholdKm: 640 })
  })

  it('reads wear as a share of the stated lifespan', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20', 400)])

    expect(byId('daily')?.wearPercent).toBe(50)
  })

  it('treats a retired pair as fully worn whatever its mileage', () => {
    getAllActivities.mockReturnValue([run('old', '2026-07-20', 12)])

    expect(byId('old')).toMatchObject({ wearPercent: 100, nearingLimit: false })
  })

  it('flags a pair that has reached its alert threshold', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20', 640)])

    expect(byId('daily')?.nearingLimit).toBe(true)
  })

  it('stays quiet one kilometre short of the threshold', () => {
    getAllActivities.mockReturnValue([run('daily', '2026-07-20', 639)])

    expect(byId('daily')?.nearingLimit).toBe(false)
  })

  it('puts the pairs still in rotation first, the most run of them at the top', () => {
    getAllActivities.mockReturnValue([
      run('daily', '2026-07-20', 100),
      run('tempo', '2026-07-19', 300),
      run('old', '2026-07-18', 500),
    ])

    expect(getShoeStats().map((s) => s.gearId)).toEqual(['tempo', 'daily', 'old'])
  })
})
