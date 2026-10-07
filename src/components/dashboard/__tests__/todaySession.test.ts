import { describe, expect, it } from 'vitest'
import type { ActivitySummary } from '@/domain/activity/types'
import { t } from '@/i18n'
import { formatWeekday } from '@/lib/formatters'
import { todaySession } from '../todaySession'

const RUN: ActivitySummary = {
  id: 'a1', date: '2026-09-24', dayOfWeek: 'Thursday', type: 'Base', description: 'Easy run', comment: '',
  distanceKm: 8.58, durationSeconds: 3_060, paceSecPerKm: 355, avgHeartRate: 140, rpe: null, hrZones: [], week: 0, elevationGain: null,
}
const PLAN = { title: 'Threshold', type: 'Threshold' as const, duration: { seconds: 1_500, estimated: false }, distanceM: 6_000, activityId: null, target: null, structure: null }

describe('todaySession', () => {
  it('is planned while the session is still to run, and goes to the plan', () => {
    expect(todaySession(PLAN, null)).toEqual({ state: 'planned', title: 'Threshold', detail: `6 ${t.units.km}`, href: '/plan' })
  })

  it('is done once a run is recorded, whether or not it was planned', () => {
    expect(todaySession(null, RUN)).toMatchObject({ state: 'done', title: 'Easy run', detail: t.sessionCard.ranAt('8.6', '5:55 /km'), href: '/activities/a1' })
  })

  it('is a rest day with nothing planned or run', () => {
    expect(todaySession(null, null)).toMatchObject({ state: 'rest', title: t.dashboard.todayHero.restDay, detail: t.dashboard.todayHero.restDaySubtitle })
  })

  // v4.17: a rest day says what comes after it, as Plan's rest card does.
  it('names the next session on a rest day', () => {
    const next = { date: '2026-09-29', title: 'Threshold 3 x 7:15', km: '10', inDays: 1, kind: 'threshold' as const }
    expect(todaySession(null, null, next).detail).toBe(t.dashboard.todayHero.next(formatWeekday('2026-09-29'), 'Threshold 3 x 7:15', '10'))
    expect(todaySession(null, null, { ...next, km: null }).detail).toBe(t.dashboard.todayHero.next(formatWeekday('2026-09-29'), 'Threshold 3 x 7:15', null))
  })
})
