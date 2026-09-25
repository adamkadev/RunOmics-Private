import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'
import { todaySession } from '../todaySession'

const RUN: ActivitySummary = {
  id: 'a1', date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Base', description: 'Easy run', comment: '',
  distanceKm: 8.58, durationSeconds: 3_060, paceSecPerKm: 355, avgHeartRate: 140, rpe: null, hrZones: [], week: 0, elevationGain: null,
}
const PLAN = { title: 'Threshold', type: 'Threshold' as const, duration: { seconds: 1_500, estimated: false }, distanceM: 6_000, activityId: null, target: null }

describe('todaySession', () => {
  it('is planned while the session is still to run, and goes to the plan', () => {
    expect(todaySession(PLAN, null)).toEqual({ state: 'planned', title: 'Threshold · 25 min Z4', detail: `6 ${t.units.km}`, href: '/plan' })
  })

  it('is done once a run is recorded, whether or not it was planned', () => {
    expect(todaySession(null, RUN)).toMatchObject({ state: 'done', title: 'Easy run', detail: t.sessionCard.ranAt('8.58', '5:55 /km'), href: '/activities/a1' })
  })

  it('is a rest day with nothing planned or run', () => {
    expect(todaySession(null, null)).toMatchObject({ state: 'rest', title: t.dashboard.todayHero.restDay })
  })
})
