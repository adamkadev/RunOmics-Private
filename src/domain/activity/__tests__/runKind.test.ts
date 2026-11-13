import { describe, expect, it } from 'vitest'
import { runKind, type KindedRun } from '../runKind'
import type { ActivitySplit } from '../types'
import type { WorkoutBlock } from '@/domain/coaching/types'

const split = (type: ActivitySplit['type'], durationSec: number, distanceM: number): ActivitySplit => ({
  type,
  durationSec,
  distanceM,
  avgSpeedMs: distanceM / durationSec,
  avgHr: null,
  laps: [],
})

const run = (over: Partial<KindedRun> = {}): KindedRun => ({ type: 'Base', description: 'Morning Run', durationSeconds: 2400, ...over }) as KindedRun

const strides = [split('interval_active', 2900, 8000), ...Array.from({ length: 6 }, () => [split('interval_active', 20, 95), split('interval_recovery', 60, 160)]).flat()]
const runWalk = Array.from({ length: 4 }, () => [split('interval_active', 360, 1000), split('interval_recovery', 120, 160)]).flat()

describe('runKind', () => {
  it('names a run by the session it was set as', () => {
    expect(runKind(run({ type: 'Tempo' }), { type: 'threshold', blocks: [] })).toBe('threshold')
    expect(runKind(run({ type: 'VO2Max' }), { type: 'long_run', blocks: [] })).toBe('long')
    expect(runKind(run({ type: 'Sprint' }), { type: 'easy', blocks: [{ kind: 'strides' } as WorkoutBlock] })).toBe('strides')
    expect(runKind(run(), { type: 'race', blocks: [] })).toBe('race')
  })

  it('reads an easy run’s strides, run/walk and length from the run itself without a session', () => {
    expect(runKind(run())).toBe('easy')
    expect(runKind(run({ type: 'Sprint', splits: strides, durationSeconds: 3500 }))).toBe('strides')
    expect(runKind(run({ splits: runWalk, description: 'Course à pied' }))).toBe('runWalk')
    expect(runKind(run({ durationSeconds: 100 * 60 }))).toBe('long')
    expect(runKind(run({ description: 'Sortie longue' }))).toBe('long')
  })

  it('takes the type a run’s name leads with over the watch’s label', () => {
    expect(runKind(run({ type: 'VO2Max', description: 'Footing · 6 × 3′' }))).toBe('easy')
    expect(runKind(run({ type: 'Tempo', description: 'Threshold' }))).toBe('threshold')
    expect(runKind(run({ type: 'VO2Max', description: 'Intervals' }))).toBe('intervals')
    expect(runKind(run({ type: 'Race', description: 'Race Day' }))).toBe('race')
  })
})
