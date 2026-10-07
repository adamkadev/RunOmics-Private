import { describe, expect, it } from 'vitest'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { findLastRun, findNextSession } from '../nextSession'
import { t } from '@/i18n'

function prescription(date: string, title: string, totalDistanceMeters: number): WorkoutPrescription {
  return {
    id: `w:${date}`, revision: 1, date, type: 'easy', title, description: '', status: 'prescribed', totalDistanceMeters,
    blocks: [{ kind: 'effort', target: { distanceMeters: totalDistanceMeters } }],
    provenance: { source: 'demo', trigger: 'bootstrap', createdAt: '2026-09-20T00:00:00Z' },
  } as WorkoutPrescription
}

function view(p: WorkoutPrescription, state: 'prescribed' | 'cancelled' = 'prescribed') {
  return { prescription: p, state, garminStatus: 'not_scheduled' as const, activityId: null }
}

describe('findNextSession', () => {
  it("is the first day after today with a session, the coach's over Garmin's", () => {
    const garmin: PlannedWorkout[] = [{ date: '2026-09-30', name: 'Tempo', type: 'Tempo', distanceM: 8000 }]
    const next = findNextSession('2026-09-28', [view(prescription('2026-09-30', 'Recovery run', 9229))], garmin)
    expect(next).toMatchObject({ date: '2026-09-30', title: 'Recovery run', km: '9', inDays: 2, kind: 'easy' })
    // The session itself, for the hero's tile.
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
  paceSecPerKm: 360, avgHeartRate: 140, rpe: null, hrZones: [], week: 0, elevationGain: null,
})

// Design review, Oct 2026: the row above the next session.
describe('findLastRun', () => {
  it("is today's run once it is done, opening the run", () => {
    const last = findLastRun('2026-10-07', run('2026-10-07', 10), null, [], [], [])
    expect(last).toMatchObject({ state: 'done', date: '2026-10-07', href: '/activities/a:2026-10-07' })
    expect(last!.title).toBe(t.dashboard.todayHero.doneTitle('Morning run'))
  })

  it("is nothing before today's run: the tile is today's session", () => {
    const today = { title: 'Easy run', type: 'Base' as const, duration: null, distanceM: 9000, activityId: null, target: null, structure: null }
    expect(findLastRun('2026-10-07', null, today, [run('2026-10-06', 10)], [], [])).toBeNull()
  })

  it("is yesterday's run on a day off, under its plan's name", () => {
    const last = findLastRun('2026-10-08', null, null, [run('2026-10-07', 10)], [view(prescription('2026-10-07', 'Recovery run', 9000))], [])
    expect(last).toMatchObject({ state: 'done', date: '2026-10-07', title: t.dashboard.todayHero.doneTitle('Recovery run') })
  })

  // Said, never moved: the plan is the coach's.
  it('is the session yesterday planned and nobody ran, opening the plan', () => {
    const garmin: PlannedWorkout[] = [{ date: '2026-10-08', name: 'Easy run', type: 'Base', distanceM: 10_000 }]
    const last = findLastRun('2026-10-09', null, null, [], [], garmin)
    expect(last).toMatchObject({ state: 'missed', date: '2026-10-08', detail: t.dashboard.todayHero.notRun('10'), href: '/plan' })
  })

  it('is nothing after a day with neither', () => {
    expect(findLastRun('2026-10-09', null, null, [run('2026-10-06', 10)], [], [])).toBeNull()
  })
})
