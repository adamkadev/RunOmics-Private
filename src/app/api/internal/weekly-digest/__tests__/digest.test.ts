import { describe, expect, it } from 'vitest'
import type { CoachingOverview } from '@/application/coaching/GetCoachingView'
import type { ActivitySummary, PlannedWorkout } from '@/domain/activity/types'
import type { CrossTrainingEntry } from '@/domain/activity/crossTraining'
import { digestPush, weeklyDigest } from '../digest'

const run = (date: string, type: ActivitySummary['type'], distanceKm: number) => ({ date, type, distanceKm }) as ActivitySummary

const activities = [run('2026-10-13', 'Base', 8), run('2026-10-15', 'Threshold', 10), run('2026-10-18', 'Base', 16), run('2026-10-19', 'Base', 5)]

const planned: PlannedWorkout[] = [
  { date: '2026-10-13', name: 'Easy', type: 'Base', distanceM: 8000 },
  { date: '2026-10-15', name: 'Threshold', type: 'Threshold', distanceM: 10000 },
  { date: '2026-10-17', name: 'Intervals', type: 'VO2Max', distanceM: 9000 },
  { date: '2026-10-18', name: 'Long run', type: 'Base', distanceM: 15000 },
]

const recovery = [
  ...['09-20', '09-24', '09-28', '10-01', '10-03', '10-05', '10-07', '10-09', '10-11'].map((d) => ({ date: `2026-${d}`, restingHr: 50 })),
  ...['10-12', '10-14', '10-16', '10-17'].map((d) => ({ date: `2026-${d}`, restingHr: 48 })),
]

const crossTraining: CrossTrainingEntry[] = [
  { id: 's1', date: '2026-10-14', kind: 'strength', durationSeconds: 2700, distanceKm: null, sets: 12 },
  { id: 'c1', date: '2026-10-16', kind: 'cycling', durationSeconds: 2700, distanceKm: 20, sets: null },
  { id: 'c2', date: '2026-10-19', kind: 'cycling', durationSeconds: 3600, distanceKm: 25, sets: null },
]

const coaching = {
  workouts: [],
  plan: { weeks: [{ startDate: '2026-10-19', endDate: '2026-10-25', focus: 'Aerobic base, one controlled threshold' }] },
} as unknown as CoachingOverview

describe('weekly digest', () => {
  it("reads Monday's look back at last week and the coach's focus for this one, one line each", () => {
    const digest = weeklyDigest({ today: '2026-10-19', activities, planned, coaching, recovery, crossTraining })

    expect(digest).toEqual({
      ranKm: 34,
      planKm: 42,
      qualityDone: 1,
      qualityPlanned: 2,
      otherTrainingSeconds: 5400,
      restingHr: { bpm: 48, change: -2 },
      focus: 'Aerobic base, one controlled threshold',
    })
    expect(digestPush(digest)).toEqual({
      title: 'Last week',
      body: '34 of 42 km · 1 of 2 quality sessions · 1:30 h other training\nResting HR 48 (−2)\nThis week: Aerobic base, one controlled threshold',
    })
  })

  it("sends the coach's focus whole, however long", () => {
    const focus = 'Same week, one slider moved: each threshold session gains a rep, everything else stays exactly as it was.'
    const digest = weeklyDigest({ today: '2026-10-19', activities, planned, coaching, recovery, crossTraining })
    expect(digestPush({ ...digest, focus })?.body.split('\n').at(-1)).toBe(`This week: ${focus}`)
  })

  it('leaves out what it cannot say, and says nothing for an empty week', () => {
    const empty = { today: '2026-10-19', planned: [], coaching: null, recovery: [], crossTraining: [] }
    expect(digestPush(weeklyDigest({ ...empty, activities: activities.slice(0, 1) }))?.body).toBe('8 km')

    expect(digestPush(weeklyDigest({ ...empty, activities: [] }))).toBeNull()
    expect(digestPush(weeklyDigest({ ...empty, activities: [], crossTraining: crossTraining.slice(0, 1) }))?.body).toBe('0 km · 45 min other training')
  })
})
