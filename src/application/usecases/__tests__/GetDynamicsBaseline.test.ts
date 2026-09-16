import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const activities: Activity[] = []

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => activities,
}))

const { getDynamicsBaseline } = await import('../GetDynamicsBaseline')

function run(date: string, dynamics: Partial<Activity> = {}): Activity {
  return { date, distanceKm: 10, ...dynamics } as Activity
}

describe('getDynamicsBaseline', () => {
  beforeEach(() => {
    activities.length = 0
  })

  it('takes the median of the eight weeks before the run', () => {
    activities.push(
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.groundContactMs).toBe(270)
  })

  it('excludes the run itself, so a run is never its own baseline', () => {
    const subject = run('2026-09-01', { groundContactMs: 999 })
    activities.push(
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
      subject,
    )

    expect(getDynamicsBaseline(subject)?.groundContactMs).toBe(270)
  })

  it('ignores runs older than the window', () => {
    activities.push(
      run('2026-01-01', { groundContactMs: 100 }),
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.groundContactMs).toBe(270)
  })

  it('reports a metric only once three runs carry it', () => {
    activities.push(
      run('2026-08-01', { groundContactMs: 260, verticalRatioPct: 7 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    const baseline = getDynamicsBaseline(run('2026-09-01'))
    expect(baseline?.groundContactMs).toBe(270)
    expect(baseline?.verticalRatioPct).toBeNull()
  })

  it('has no baseline at all from fewer than three runs', () => {
    activities.push(run('2026-08-01', { groundContactMs: 260 }), run('2026-08-08', { groundContactMs: 270 }))

    expect(getDynamicsBaseline(run('2026-09-01'))).toBeNull()
  })

  it('has no baseline when the window holds runs but no dynamics at all', () => {
    activities.push(run('2026-08-01'), run('2026-08-08'), run('2026-08-15'))

    expect(getDynamicsBaseline(run('2026-09-01'))).toBeNull()
  })
})
