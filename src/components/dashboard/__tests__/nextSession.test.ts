import { describe, expect, it } from 'vitest'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { findNextSession, runWalkName, sessionCard } from '../nextSession'
import { readinessReason } from '../readinessReason'
import { formatWeekday, formatWeekdayLong } from '@/lib/formatters'
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
    expect(next).toMatchObject({ date: '2026-09-30', title: 'Recovery run', km: '9.2', inDays: 2, kind: 'easy' })
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
  it("is today's session until it is run, opening Plan on today, with no eyebrow and no rest", () => {
    const card = sessionCard('2026-10-19', EASY, null, null, { phaseOn: () => 'Base', hrCapOf: () => 158 })
    expect(card).toMatchObject({
      date: '2026-10-19',
      eyebrow: null,
      rest: null,
      title: 'Easy',
      km: '10',
      detail: `1 ${t.units.hour} · ${t.dashboard.todayHero.hrCap(158)} ${t.units.bpm}`,
      phase: 'Base',
      href: '/plan?date=2026-10-19',
    })
  })

  it('moves on to the next session once today is run, tomorrow named as such', () => {
    const next = { date: '2026-10-20', title: 'Easy run', km: '10', inDays: 1, kind: 'easy' as const, workout: EASY }
    const card = sessionCard('2026-10-19', EASY, run('2026-10-19', 10), next)
    expect(card).toMatchObject({ date: '2026-10-20', eyebrow: `${t.dashboard.todayHero.tomorrow} · ${formatWeekday('2026-10-20', true)}`, href: '/plan?date=2026-10-20', phase: null, rest: null })
    // Further out, the day alone.
    expect(sessionCard('2026-10-19', null, null, { ...next, date: '2026-10-22', inDays: 3 })!.eyebrow).toBe(formatWeekday('2026-10-22', true))
  })

  it('leads a day with no session and no run with the rest, naming the next session and its day', () => {
    const s = t.dashboard.todayHero
    const next = { date: '2026-10-20', title: 'Threshold 4 × 5′', km: '10', inDays: 1, kind: 'threshold' as const, workout: { ...EASY, type: 'Threshold' as const } }
    expect(sessionCard('2026-10-19', null, null, next)!.rest).toBe(s.restLine(t.dashboard.weeklyStreak.kinds.threshold, s.restTomorrow))
    expect(sessionCard('2026-10-19', null, null, { ...next, date: '2026-10-21', inDays: 2 })!.rest).toBe(
      s.restLine(t.dashboard.weeklyStreak.kinds.threshold, s.restOn(formatWeekdayLong('2026-10-21'))),
    )
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
    expect(next).toMatchObject({ title: 'Threshold 3 × 8′', workout: { title: 'Threshold · 3 × 8′ @ 4:25', shortName: 'Threshold 3×8′' } })
    expect(sessionCard('2026-10-05', null, null, next)!.title).toBe('Threshold 3 × 8′')
  })
})


describe('a run/walk session', () => {
  const steps = [
    { kind: 'warmup' as const, minutes: 5, seconds: 300 },
    ...Array.from({ length: 4 }, (_, i) => [
      { kind: 'effort' as const, minutes: 6, seconds: 360, rep: i + 1 },
      { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
    ]).flat().slice(0, -1),
    { kind: 'cooldown' as const, minutes: 5, seconds: 300 },
  ]
  const runWalk = { ...EASY, title: 'Footing · 4 × 6′', shortName: 'Footing 4×6′', structure: steps }

  it('is named run/walk with its set, not by the easy word', () => {
    expect(runWalkName('Footing 4 × 6′', runWalk)).toBe(`${t.dashboard.todayHero.runWalk} 4 × 6′`)
    expect(sessionCard('2026-10-19', runWalk, null, null)!.title).toBe(`${t.dashboard.todayHero.runWalk} 4 × 6′`)
  })

  it('keeps the name of a session with no walk breaks', () => {
    expect(runWalkName('Easy run', EASY)).toBe('Easy run')
    expect(runWalkName('Threshold 4 × 6′', { ...runWalk, title: 'Threshold · 4 × 6′', type: 'Threshold' })).toBe('Threshold 4 × 6′')
  })

  it('says run/walk on the rest line too', () => {
    const next = { date: '2026-10-20', title: 'Footing 4 × 6′', km: null, inDays: 1, kind: 'easy' as const, workout: runWalk }
    const s = t.dashboard.todayHero
    expect(sessionCard('2026-10-19', null, null, next)!.rest).toBe(s.restLine(s.runWalk, s.restTomorrow))
  })
})

describe('readinessReason', () => {
  const threshold = (date: string): WorkoutPrescription => ({ ...prescription(date, 'Threshold 4 × 5′', 10_000), type: 'threshold' })
  const next = (date: string) => findNextSession('2026-11-13', [view(threshold(date))], [])

  it('is the rest before the next session on a day with nothing planned or run', () => {
    expect(readinessReason('2026-11-13', [view(threshold('2026-11-14'))], [], [], next('2026-11-14'))).toEqual({ kind: 'rest', session: 'threshold', date: '2026-11-14' })
  })

  it("is yesterday's hard session when it was run", () => {
    const coach = [view(threshold('2026-11-12')), view(prescription('2026-11-13', 'Easy run', 8000))]
    expect(readinessReason('2026-11-13', coach, [], [run('2026-11-12', 10)], null)).toEqual({ kind: 'yesterday', session: 'threshold' })
    expect(readinessReason('2026-11-13', coach, [], [], null)).toBeNull()
  })

  it("is today's hard session until it is run, and nothing after an easy day", () => {
    const coach = [view(threshold('2026-11-13'))]
    expect(readinessReason('2026-11-13', coach, [], [run('2026-11-12', 6)], null)).toEqual({ kind: 'today', session: 'threshold' })
    expect(readinessReason('2026-11-13', coach, [], [run('2026-11-13', 10)], null)).toBeNull()
  })
})
