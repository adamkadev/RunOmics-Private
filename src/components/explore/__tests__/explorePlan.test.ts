import { describe, expect, it } from 'vitest'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { explorePlanOn } from '../explorePlan'

const session = {
  id: 'w:2026-11-12', revision: 1, date: '2026-11-12', type: 'easy', title: 'Easy · 6 km + 6 strides', shortName: 'Easy + strides',
  description: '', status: 'prescribed', totalDistanceMeters: 7500,
  blocks: [{ kind: 'effort', target: { distanceMeters: 7500 } }],
  provenance: { source: 'demo', trigger: 'bootstrap', createdAt: '2026-11-01T00:00:00Z' },
} as WorkoutPrescription

describe('explorePlanOn', () => {
  it("names the session by the coach's short name, as Today does, beside its whole distance", () => {
    const plan = explorePlanOn('2026-11-12', [{ prescription: session, state: 'prescribed', activityId: null, distanceMeters: 7500 }], [], null)
    expect(plan?.label).toContain('Easy + strides')
    expect(plan?.label).not.toContain('6 km')
    expect(plan?.distanceM).toBe(7500)
  })
})
