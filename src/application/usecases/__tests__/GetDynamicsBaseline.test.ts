import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Activity } from '@/domain/activity/types'

const activities: Activity[] = []

vi.mock('@/infrastructure/repositories/JsonActivityRepository', () => ({
  getAllActivities: () => activities,
}))

const { getDynamicsBaseline } = await import('../GetDynamicsBaseline')

function run(date: string, dynamics: Partial<Activity> = {}): Activity {
  return { date, distanceKm: 10, type: 'Base', ...dynamics } as Activity
}

describe('getDynamicsBaseline', () => {
  beforeEach(() => {
    activities.length = 0
  })

  it('leaves races and other sports out of the range', () => {
    activities.push(
      run('2026-08-01', { strideLengthM: 0.96 }),
      run('2026-08-08', { strideLengthM: 1.04 }),
      run('2026-08-15', { strideLengthM: 1.14 }),
      run('2026-08-20', { strideLengthM: 1.4, type: 'Race' }),
      run('2026-08-21', { strideLengthM: 2.2, sport: 'cycling' }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.strideLengthM).toMatchObject({ min: 0.96, median: 1.04, max: 1.14 })
  })

  it('takes the median of the eight weeks before the run', () => {
    activities.push(
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.groundContactMs?.median).toBe(270)
  })

  it('excludes the run itself, so a run is never its own baseline', () => {
    const subject = run('2026-09-01', { groundContactMs: 999 })
    activities.push(
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
      subject,
    )

    expect(getDynamicsBaseline(subject)?.groundContactMs?.median).toBe(270)
  })

  it('ignores runs older than the window', () => {
    activities.push(
      run('2026-01-01', { groundContactMs: 100 }),
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.groundContactMs?.median).toBe(270)
  })

  it('reports a metric only once three runs carry it', () => {
    activities.push(
      run('2026-08-01', { groundContactMs: 260, verticalRatioPct: 7 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    const baseline = getDynamicsBaseline(run('2026-09-01'))
    expect(baseline?.groundContactMs?.median).toBe(270)
    expect(baseline?.verticalRatioPct).toBeNull()
  })

  it('carries each metric\'s own range alongside its median', () => {
    activities.push(
      run('2026-08-01', { groundContactMs: 260 }),
      run('2026-08-08', { groundContactMs: 270 }),
      run('2026-08-15', { groundContactMs: 280 }),
    )

    expect(getDynamicsBaseline(run('2026-09-01'))?.groundContactMs).toEqual({
      median: 270,
      min: 260,
      max: 280,
      low: 265,
      high: 275,
    })
  })

  it('carries the middle half of the runs as the baseline band', () => {
    activities.push(
      ...[250, 255, 260, 262, 270, 280, 300].map((ms, i) => run(`2026-08-0${i + 1}`, { groundContactMs: ms })),
    )

    const band = getDynamicsBaseline(run('2026-09-01'))?.groundContactMs
    expect(band?.low).toBe(258)
    expect(band?.high).toBe(275)
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
