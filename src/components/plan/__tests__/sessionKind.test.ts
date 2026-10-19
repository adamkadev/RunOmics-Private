import { describe, expect, it } from 'vitest'
import { buildCoachingOverview, type PrescriptionView } from '@/application/coaching/GetCoachingView'
import type { PlannedWorkout } from '@/domain/activity/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { t } from '@/i18n'
import { dayKind, kindLabel, plannedLong } from '../sessionKind'

const DATE = '2026-09-09'
const garmin = (p: Omit<PlannedWorkout, 'date'>) => new Map([[DATE, { date: DATE, ...p }]])
const run = (type: 'Base' | 'Threshold', durationSeconds: number, description = '') => ({ type, durationSeconds, description })

function coach(type: 'long_run' | 'easy'): Map<string, PrescriptionView[]> {
  const overview = buildCoachingOverview(
    plan({ weeks: [{ id: 'w', index: 1, startDate: '2026-09-07', endDate: '2026-09-13', focus: '', workouts: [workout({ type, title: 'Run' })] }] }),
    [], [], [], [], DATE,
  )
  return new Map([[DATE, overview.workouts]])
}

describe('a day’s kind', () => {
  it('draws easy and quality days in their type’s zone', () => {
    expect(dayKind(DATE, [], garmin({ name: 'Easy', type: 'Base' }))).toEqual({ type: 'Base', kind: 'easy', color: 'var(--zone-2)' })
    expect(dayKind(DATE, [], garmin({ name: 'Intervals', type: 'Threshold' }))).toEqual({ type: 'Threshold', kind: 'quality', color: 'var(--zone-4)' })
  })

  it('knows the long run by the coach’s type or the plan’s name', () => {
    expect(plannedLong(DATE, new Map(), coach('long_run'))).toBe(true)
    expect(plannedLong(DATE, new Map(), coach('easy'))).toBe(false)
    expect(plannedLong(DATE, garmin({ name: 'Long run', type: 'Base' }))).toBe(true)
    expect(plannedLong(DATE, garmin({ name: 'Long intervals', type: 'Threshold' }))).toBe(false)
    expect(dayKind(DATE, [], garmin({ name: 'Sortie longue', type: 'Base' }))?.color).toBe('var(--zone-2)')
  })

  it('reads a run day by what was run: a 90-minute easy run is the long run', () => {
    expect(dayKind(DATE, [run('Base', 95 * 60)], new Map())?.kind).toBe('long')
    expect(dayKind(DATE, [run('Base', 40 * 60)], new Map())?.kind).toBe('easy')
    expect(dayKind(DATE, [run('Threshold', 95 * 60)], garmin({ name: 'Long run', type: 'Base' }))?.kind).toBe('quality')
  })

  it('has no kind on a rest day', () => {
    expect(dayKind(DATE, [], new Map())).toBeNull()
  })

  it('names a quality session by its type and the others by their kind', () => {
    expect(kindLabel('Threshold', 'quality')).toBe(t.activityTypes.Threshold)
    expect(kindLabel('Base', 'long')).toBe(t.plan.kinds.long)
    expect(kindLabel('Base', 'easy')).toBe(t.plan.kinds.easy)
  })
})
