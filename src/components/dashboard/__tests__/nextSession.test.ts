import { describe, expect, it } from 'vitest'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { findNextSession, sessionCard } from '../nextSession'
import { formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'

function prescription(date: string, title: string, totalDistanceMeters: number): WorkoutPrescription {
  return {
    id: `w:${date}`, revision: 1, date, type: 'easy', title, description: '', status: 'prescribed', totalDistanceMeters,
    blocks: [{ kind: 'effort', target: { distanceMeters: totalDistanceMeters } }],
    provenance: { source: 'demo', trigger: 'bootstrap', createdAt: '2026-09-20T00:00:00Z' },
  } as WorkoutPrescription
}

function view(p: WorkoutPrescription, state: 'prescribed' | 'cancelled' = 'prescribed') {
  return { prescription: p, state, activityId: null, distanceMeters: p.totalDistanceMeters ?? null }
}

describe('findNextSession', () => {
  it("is the first day after today with a session, the coach's over Garmin's", () => {
    const garmin: PlannedWorkout[] = [{ date: '2026-09-30', name: 'Tempo', type: 'Tempo', distanceM: 8000 }]
    const next = findNextSession('2026-09-28', [view(prescription('2026-09-30', 'Recovery run', 9229))], garmin)
    expect(next).toMatchObject({ date: '2026-09-30', title: 'Recovery run', km: '9', inDays: 2, kind: 'easy' })
    expect(next!.workout).toMatchObject({ title: 'Recovery run', distanceM: 9229 })
  })

  it('skips a cancelled prescription and falls back to Garmin', () => {
    const garmin: PlannedWorkout[] = [{ date: '2026-09-29', name: 'Tempo', type: 'Tempo' }]
    const next = findNextSession('2026-09-28', [view(prescription('2026-09-29', 'Easy run', 8000), 'cancelled')], garmin)
    // Garmin's type, in the coach's words.
    expect(next).toMatchObject({ date: '2026-09-29', km: null, inDays: 1, kind: 'tempo' })
  })

  it('looks a week ahead, not today and not further', () => {
    expect(findNextSession('2026-09-28', [view(prescription('2026-09-28', 'Easy run', 8000))], [])).toBeNull()
    expect(findNextSession('2026-09-28', [view(prescription('2026-10-06', 'Easy run', 8000))], [])).toBeNull()
  })
})

const run = (date: string, km: number): ActivitySummary => ({
  id: `a:${date}`, date, dayOfWeek: '', type: 'Base', description: 'Morning run', comment: '', distanceKm: km, durationSeconds: km * 360,
  paceSecPerKm: 360, avgHeartRate: 140, zones: [], routeThumb: null,
})

const EASY = { key: 'garmin:2026-10-19:Easy run', title: 'Easy run', type: 'Base' as const, duration: { seconds: 3_600, estimated: false }, distanceM: 10_000, activityId: null, target: null, structure: null, hr: null }

describe('sessionCard', () => {
  it("is today's session until it is run, opening Plan on today", () => {
    const card = sessionCard('2026-10-19', EASY, null, null, { phaseOn: () => 'Base', hrCapOf: () => 158 })
    expect(card).toMatchObject({
      date: '2026-10-19',
      eyebrow: `${t.dashboard.todayHero.today} · ${formatWeekday('2026-10-19', true)}`,
      title: 'Easy run',
      km: '10',
      detail: `1:00 ${t.units.hour} · ${t.dashboard.todayHero.hrCap(158)} ${t.units.bpm}`,
      phase: 'Base',
      href: '/plan?date=2026-10-19',
    })
  })

  it('moves on to the next session once today is run, tomorrow named as such', () => {
    const next = { date: '2026-10-20', title: 'Easy run', km: '10', inDays: 1, kind: 'easy' as const, workout: EASY }
    const card = sessionCard('2026-10-19', EASY, run('2026-10-19', 10), next)
    expect(card).toMatchObject({ date: '2026-10-20', eyebrow: `${t.dashboard.todayHero.tomorrow} · ${formatWeekday('2026-10-20', true)}`, href: '/plan?date=2026-10-20', phase: null })
    // Further out, the day alone.
    expect(sessionCard('2026-10-19', null, null, { ...next, date: '2026-10-22', inDays: 3 })!.eyebrow).toBe(formatWeekday('2026-10-22', true))
  })

  it('is none with nothing left to run in the week ahead', () => {
    expect(sessionCard('2026-10-19', null, null, null)).toBeNull()
  })
})

// The card names a session by the coach's short name, where it has one.
describe('a session named under the naming rules', () => {
  const named = (date: string): WorkoutPrescription => ({
    ...prescription(date, 'Threshold · 3 × 8′ @ 4:25', 10_665),
    type: 'threshold',
    shortName: 'Threshold 3×8′',
  })

  it('is the short name on the card', () => {
    const next = findNextSession('2026-10-05', [view(named('2026-10-06'))], [])
    expect(next).toMatchObject({ title: 'Threshold 3×8′', workout: { title: 'Threshold · 3 × 8′ @ 4:25', shortName: 'Threshold 3×8′' } })
    expect(sessionCard('2026-10-05', null, null, next)!.title).toBe('Threshold 3×8′')
  })
})

