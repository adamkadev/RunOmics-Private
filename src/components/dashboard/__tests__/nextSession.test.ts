import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { findNextSession } from '../nextSession'

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
    expect(next).toEqual({ date: '2026-09-30', title: 'Recovery run', km: '9' })
  })

  it('skips a cancelled prescription and falls back to Garmin', () => {
    const garmin: PlannedWorkout[] = [{ date: '2026-09-29', name: 'Tempo', type: 'Tempo' }]
    const next = findNextSession('2026-09-28', [view(prescription('2026-09-29', 'Easy run', 8000), 'cancelled')], garmin)
    expect(next).toMatchObject({ date: '2026-09-29', km: null })
  })

  it('looks a week ahead, not today and not further', () => {
    expect(findNextSession('2026-09-28', [view(prescription('2026-09-28', 'Easy run', 8000))], [])).toBeNull()
    expect(findNextSession('2026-09-28', [view(prescription('2026-10-06', 'Easy run', 8000))], [])).toBeNull()
  })
})
