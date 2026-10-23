import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { t } from '@/i18n'
import { planPaceSecPerKm } from '@/components/plan/planPace'
import { EXPLORE_PLAN_DAYS, explorePlanOn, explorePlansFrom } from '../explorePlan'

const TODAY = '2026-10-22'

function prescription(over: Partial<WorkoutPrescription> = {}): WorkoutPrescription {
  return {
    id: `w:${TODAY}`,
    revision: 1,
    date: TODAY,
    type: 'easy',
    title: 'Easy · 8 km + 6 strides',
    description: 'The coach’s reasoning, which must never reach the page.',
    notes: ['A private note'],
    status: 'prescribed',
    totalDistanceMeters: 9462,
    totalDurationSeconds: 3336,
    blocks: [{ kind: 'effort', target: { distanceMeters: 9462 } }],
    provenance: { source: 'demo', trigger: 'bootstrap', createdAt: '2026-09-20T00:00:00Z' },
    ...over,
  } as WorkoutPrescription
}

const view = (p: WorkoutPrescription, state: 'prescribed' | 'cancelled' = 'prescribed') => ({
  prescription: p,
  state,
  garminStatus: 'not_scheduled' as const,
  activityId: null,
})

describe('explorePlanOn: today’s plan for the route generator', () => {
  it('is the coach’s session: its kind and name, its whole distance, its average pace - and nothing else', () => {
    const plan = explorePlanOn(TODAY, [view(prescription())], [], null)
    expect(plan).toEqual({ date: TODAY, label: `${t.plan.kinds.easy} · 8 km + 6 strides`, distanceM: 9462, paceSecPerKm: 353 })
    // A trimmed copy: none of the coach's words travel with it.
    expect(JSON.stringify(plan)).not.toContain('reasoning')
    expect(JSON.stringify(plan)).not.toContain('private')
  })

  it('names a quality session by its type', () => {
    const plan = explorePlanOn(TODAY, [view(prescription({ type: 'threshold', title: 'Threshold · 3 × 8′ @ 4:25' }))], [], null)
    expect(plan?.label).toBe(`${t.activityTypes.Threshold} · 3 × 8′ @ 4:25`)
  })

  it('names a session with no set by its title alone, never its kind twice', () => {
    const coach = (type: WorkoutPrescription['type'], title: string) => explorePlanOn(TODAY, [view(prescription({ type, title }))], [], null)?.label
    expect(coach('long_run', 'Long run')).toBe('Long run')
    expect(coach('easy', 'Easy run')).toBe('Easy run')
    expect(coach('recovery', 'Recovery run')).toBe('Recovery run')
    const garmin: PlannedWorkout[] = [{ date: TODAY, name: 'Long run', type: 'Base', distanceM: 16000, durationSecs: 5760 }]
    expect(explorePlanOn(TODAY, [], garmin, null)?.label).toBe('Long run')
    // A set keeps its kind in front.
    expect(coach('long_run', 'Long run · 16 km')).toBe(`${t.plan.kinds.long} · 16 km`)
  })

  it('falls back to Garmin’s session when the coach has none, or has cancelled it', () => {
    const garmin: PlannedWorkout[] = [{ date: TODAY, name: 'Base run', type: 'Base', distanceM: 8000, durationSecs: 2800 }]
    expect(explorePlanOn(TODAY, [], garmin, null)).toMatchObject({ distanceM: 8000, paceSecPerKm: 350 })
    expect(explorePlanOn(TODAY, [view(prescription(), 'cancelled')], garmin, null)).toMatchObject({ distanceM: 8000 })
  })

  it('is null on a day with no session, and on race day', () => {
    expect(explorePlanOn(TODAY, [view(prescription({ date: '2026-10-23' }))], [], null)).toBeNull()
    expect(explorePlanOn(TODAY, [view(prescription({ type: 'race', title: '10K de Metz' }))], [], null)).toBeNull()
    expect(explorePlanOn(TODAY, [], [{ date: TODAY, name: 'Metz 10K', type: 'Race', distanceM: 10000 }], null)).toBeNull()
  })

  it('has no distance or pace where the plan gives none', () => {
    const garmin: PlannedWorkout[] = [{ date: TODAY, name: 'Easy run', type: 'Base' }]
    expect(explorePlanOn(TODAY, [], garmin, null)).toMatchObject({ distanceM: null, paceSecPerKm: null })
  })
})

describe('explorePlansFrom: the sessions to come, for Plan’s links', () => {
  it('has every planned day from today over the coach’s four weeks, in order, races and empty days left out', () => {
    const coach = [
      view(prescription()),
      view(prescription({ id: 'w:sat', date: '2026-10-24', type: 'long_run', title: 'Long run', totalDistanceMeters: 16000, totalDurationSeconds: 5760 })),
      view(prescription({ id: 'w:race', date: '2026-10-25', type: 'race', title: '10K de Metz' })),
      view(prescription({ id: 'w:past', date: '2026-10-21' })),
      view(prescription({ id: 'w:far', date: '2026-11-19' })),
    ]
    const plans = explorePlansFrom(TODAY, coach, [], null)
    expect(plans.map((p) => p.date)).toEqual([TODAY, '2026-10-24'])
    expect(plans[1]).toEqual({ date: '2026-10-24', label: 'Long run', distanceM: 16000, paceSecPerKm: 360 })
    // Four weeks: the 28th day is in, the 29th is not.
    expect(explorePlansFrom(TODAY, [view(prescription({ id: 'w:28', date: '2026-11-18' }))], [], null)).toHaveLength(1)
    expect(EXPLORE_PLAN_DAYS).toBe(28)
  })
})

describe('planPaceSecPerKm', () => {
  const base = { title: 'Easy run', shortName: undefined, structure: null }
  it('is the duration over the distance', () => {
    expect(planPaceSecPerKm({ ...base, distanceM: 10000, duration: { seconds: 3600, estimated: false } })).toBe(360)
  })

  it('else the middle of the easy or target pace', () => {
    const structure = [{ kind: 'effort' as const, minutes: 40, paceSecPerKm: [330, 384] as [number, number] }]
    expect(planPaceSecPerKm({ ...base, structure, distanceM: null, duration: null } as Parameters<typeof planPaceSecPerKm>[0])).toBe(357)
  })

  it('else nothing', () => {
    expect(planPaceSecPerKm({ ...base, distanceM: null, duration: null })).toBeNull()
  })
})
