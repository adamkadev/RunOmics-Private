import { describe, expect, it } from 'vitest'
import { prescriptionDistanceMeters, prescriptionSize } from '../presentation'
import { workout } from '@/domain/coaching/__tests__/fixtures'

const EASY = { min: 330, max: 384 }
const THRESHOLD = { min: 262, max: 268 }

/** The block's real Wednesday session: 3 x 7:00 between a warm-up and a cool-down. */
const timedThreshold = () => workout({
  type: 'threshold',
  title: '3 x 7:00 threshold',
  totalDistanceMeters: undefined,
  blocks: [
    { kind: 'warmup', target: { distanceMeters: 2000, paceSecPerKm: EASY } },
    {
      kind: 'repeat',
      repetitions: 3,
      steps: [
        { kind: 'effort', target: { durationSeconds: 420, paceSecPerKm: THRESHOLD } },
        { kind: 'recovery', target: { distanceMeters: 600, paceSecPerKm: EASY } },
      ],
    },
    { kind: 'cooldown', target: { distanceMeters: 1600, paceSecPerKm: EASY } },
  ],
})

describe('prescriptionDistanceMeters', () => {
  it('counts repetitions prescribed as time, not only the running either side of them', () => {
    // Summing distanceMeters alone gives 2000 + 3x600 + 1600 = 5400, and the
    // week view showed a 10 km session as 5 km.
    const meters = prescriptionDistanceMeters(timedThreshold())

    expect(meters).toBeGreaterThan(10_000)
    expect(meters).toBeLessThan(10_400)
  })

  it('agrees with the size label drawn from the same workout', () => {
    const meters = prescriptionDistanceMeters(timedThreshold())!
    expect(prescriptionSize(timedThreshold())).toBe(`~${Number((meters / 1000).toFixed(1))} km`)
  })

  it('prefers a stored total over recomputing one', () => {
    expect(prescriptionDistanceMeters(workout({ totalDistanceMeters: 8345 }))).toBe(8345)
  })

  it('says nothing when no segment carries a distance or a paced duration', () => {
    const shapeless = workout({
      totalDistanceMeters: undefined,
      blocks: [{ kind: 'effort', target: { durationSeconds: 1800 } }],
    })

    expect(prescriptionDistanceMeters(shapeless)).toBeNull()
  })
})

describe('macrocycleWeek on a Sunday start (v5.5 #8)', () => {
  const plan = { macrocycleStartDate: '2026-09-06', block: { startDate: '2026-09-23' }, targetEvent: { date: '2026-11-29' } }

  it('reads the same week on Plan (its Monday) and Goals (today)', async () => {
    const { macrocycleWeek } = await import('../presentation')
    expect(macrocycleWeek(plan as never, '2026-09-21')).toEqual({ done: 3, total: 12 })
    expect(macrocycleWeek(plan as never, '2026-09-27')).toEqual({ done: 3, total: 12 })
    expect(macrocycleWeek(plan as never, '2026-09-28')).toEqual({ done: 4, total: 12 })
  })
})

describe('a general block, with no race to count toward', () => {
  const plan = { macrocycleStartDate: '2026-10-19', block: { startDate: '2026-10-19' } }

  it('draws no phases and no week-of-target count', async () => {
    const { macrocyclePhaseRanges, macrocycleWeek } = await import('../presentation')
    expect(macrocyclePhaseRanges(plan)).toEqual([])
    expect(macrocycleWeek(plan, '2026-10-26')).toBeNull()
  })
})
