import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '@/domain/activity/types'
import { tileSegments } from '../WorkoutStructure'

describe('tileSegments', () => {
  const STRIDES: WorkoutStep[] = [
    { kind: 'effort', minutes: 54, seconds: 3_213, paceSecPerKm: [330, 384] },
    ...Array.from({ length: 6 }, (_, i) => [
      { kind: 'effort' as const, minutes: 1, seconds: 20, rep: i + 1, paceSecPerKm: [215, 230] as [number, number] },
      { kind: 'recovery' as const, minutes: 1, seconds: 60, rep: i + 1 },
    ]).flat(),
  ]
  const THRESHOLD: WorkoutStep[] = [
    { kind: 'warmup', minutes: 12, seconds: 714 },
    ...Array.from({ length: 3 }, (_, i) => [
      { kind: 'effort' as const, minutes: 8, seconds: 460, rep: i + 1 },
      { kind: 'recovery' as const, minutes: 4, seconds: 240, rep: i + 1 },
    ]).flat(),
    { kind: 'cooldown', minutes: 10, seconds: 571 },
  ]

  it('is one block in the zone for a continuous run', () => {
    expect(tileSegments([], 2)).toEqual([{ weight: 1, fill: 'var(--zone-2)' }])
  })

  it('draws an easy run in its zone and each stride, with its jog, as a sliver of Z5', () => {
    expect(tileSegments(STRIDES, 2)).toEqual([
      { weight: 3_213, fill: 'var(--zone-2)' },
      ...Array.from({ length: 6 }, () => ({ weight: 80, fill: 'var(--zone-5)' })),
    ])
  })

  it('draws reps in the session zone with their recoveries, and none that ends the session', () => {
    const segments = tileSegments(THRESHOLD, 4)

    expect(segments.map((segment) => segment.weight)).toEqual([714, 460, 240, 460, 240, 460, 240, 571])
    expect(segments.filter((segment) => segment.fill === 'var(--zone-4)')).toHaveLength(3)
    expect(tileSegments(THRESHOLD.slice(0, -1), 4).map((segment) => segment.weight)).toEqual([714, 460, 240, 460, 240, 460])
  })

  it('draws a plan with no zone in Z2', () => {
    expect(tileSegments([], null)).toEqual([{ weight: 1, fill: 'var(--zone-2)' }])
  })
})
