import { describe, it, expect } from 'vitest'
import { buildWeekCompliance } from '../planCompliance'
import type { Activity, PlannedWorkout } from '@/domain/activity/types'

const TODAY = '2026-06-11'

const act = (durationSeconds = 1800, avgHeartRate = 150): Activity =>
  ({ durationSeconds, avgHeartRate, distanceKm: 5, date: TODAY }) as Activity

const plan = (over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({ date: TODAY, name: 'plan', ...over })

describe('buildWeekCompliance', () => {
  it('marks a day with a plan and an activity as done', () => {
    const { days } = buildWeekCompliance([{ date: '2026-06-08', activities: [act()], planned: plan() }], TODAY)
    expect(days[0]?.status).toBe('done')
  })

  it('marks a past planned day with no activity as missed', () => {
    const { days } = buildWeekCompliance([{ date: '2026-06-08', activities: [], planned: plan() }], TODAY)
    expect(days[0]?.status).toBe('missed')
  })

  it('marks a future planned day with no activity as upcoming, not missed', () => {
    const { days } = buildWeekCompliance([{ date: '2026-06-15', activities: [], planned: plan() }], TODAY)
    expect(days[0]?.status).toBe('upcoming')
  })

  it('marks an unplanned activity as extra', () => {
    const { days } = buildWeekCompliance([{ date: '2026-06-08', activities: [act()] }], TODAY)
    expect(days[0]?.status).toBe('extra')
  })

  it('marks a day with neither a plan nor an activity as rest', () => {
    const { days } = buildWeekCompliance([{ date: '2026-06-08', activities: [] }], TODAY)
    expect(days[0]?.status).toBe('rest')
  })

  it('computes session compliance % across only due (past/today) planned days', () => {
    const { sessionsCompliancePct } = buildWeekCompliance(
      [
        { date: '2026-06-08', activities: [act()], planned: plan({ date: '2026-06-08' }) }, // done
        { date: '2026-06-09', activities: [], planned: plan({ date: '2026-06-09' }) }, // missed
        { date: '2026-06-15', activities: [], planned: plan({ date: '2026-06-15' }) }, // upcoming, excluded
      ],
      TODAY,
    )
    expect(sessionsCompliancePct).toBe(50)
  })

  it('is null when there are no due planned days', () => {
    const { sessionsCompliancePct, loadCompliancePct } = buildWeekCompliance(
      [{ date: '2026-06-08', activities: [act()] }],
      TODAY,
    )
    expect(sessionsCompliancePct).toBeNull()
    expect(loadCompliancePct).toBeNull()
  })

  it('computes load compliance % from estimatedLoad vs realized trimp', () => {
    const hrBounds = { maxHr: 190, restingHr: 50 }
    const { loadCompliancePct } = buildWeekCompliance(
      [
        { date: '2026-06-08', activities: [act(1800, 150)], planned: plan({ date: '2026-06-08', estimatedLoad: 50 }) },
        { date: '2026-06-09', activities: [], planned: plan({ date: '2026-06-09', estimatedLoad: 50 }) },
      ],
      TODAY,
      hrBounds,
    )
    expect(loadCompliancePct).not.toBeNull()
    expect(loadCompliancePct).toBeGreaterThan(0)
    expect(loadCompliancePct).toBeLessThan(100)
  })
})
