import { describe, it, expect } from 'vitest'
import { aerobicDecoupling } from '../decoupling'
import type { Activity, ActivitySplit } from '../types'

const run = (paceSamples: number[], hrSamples: number[], overrides: Partial<Activity> = {}) =>
  ({ paceSamples, hrSamples, durationSeconds: 3600, splits: null, ...overrides }) as Activity

const flat = (n: number, value: number) => Array.from({ length: n }, () => value)

const activeSplit = (): ActivitySplit => ({
  type: 'interval_active',
  durationSec: 300,
  distanceM: 1000,
  avgSpeedMs: 3.3,
  avgHr: 165,
  laps: [],
})

describe('aerobicDecoupling', () => {
  it('reports no drift when pace and heart rate both hold', () => {
    const result = aerobicDecoupling(run(flat(150, 300), flat(150, 150)))

    expect(result).toEqual({ percent: 0, drift: 'stable' })
  })

  it('reports drift when heart rate climbs at an unchanged pace', () => {
    const hr = [...flat(75, 150), ...flat(75, 165)]

    const result = aerobicDecoupling(run(flat(150, 300), hr))

    expect(result?.percent).toBeCloseTo(9.1, 1)
    expect(result?.drift).toBe('drifting')
  })

  it('reports negative drift when the second half is more efficient', () => {
    const hr = [...flat(75, 165), ...flat(75, 150)]

    expect(aerobicDecoupling(run(flat(150, 300), hr))?.percent).toBeLessThan(0)
  })

  it('holds 4.9% to stable and 5.1% to drifting', () => {
    const stable = aerobicDecoupling(run(flat(150, 300), [...flat(75, 150), ...flat(75, 157.7)]))
    const drifting = aerobicDecoupling(run(flat(150, 300), [...flat(75, 150), ...flat(75, 158.2)]))

    expect(stable?.drift).toBe('stable')
    expect(drifting?.drift).toBe('drifting')
  })

  it('ignores walking and stopped samples', () => {
    const pace = [...flat(20, 1200), ...flat(130, 300)]
    const hr = [...flat(20, 80), ...flat(130, 150)]

    expect(aerobicDecoupling(run(pace, hr))).toEqual({ percent: 0, drift: 'stable' })
  })

  it.each([
    ['a run under 30 minutes', { durationSeconds: 1799 }],
    ['an interval session', { splits: [activeSplit(), activeSplit()] }],
  ])('returns null for %s', (_label, overrides) => {
    expect(aerobicDecoupling(run(flat(150, 300), flat(150, 150), overrides))).toBeNull()
  })

  it.each([
    ['missing samples', run(flat(150, 300), null as unknown as number[])],
    ['mismatched series', run(flat(150, 300), flat(120, 150))],
    ['too few clean samples', run([...flat(100, 1200), ...flat(50, 300)], flat(150, 150))],
  ])('returns null on %s', (_label, activity) => {
    expect(aerobicDecoupling(activity)).toBeNull()
  })

  it('keeps a single interval split eligible, since that is a steady run', () => {
    expect(aerobicDecoupling(run(flat(150, 300), flat(150, 150), { splits: [activeSplit()] }))).not.toBeNull()
  })

  it('matches the real-world range on a gently drifting run', () => {
    const hr = Array.from({ length: 150 }, (_, i) => 145 + i * 0.06)

    const result = aerobicDecoupling(run(flat(150, 300), hr))

    expect(result?.percent).toBeGreaterThan(0)
    expect(result?.percent).toBeLessThan(5)
  })
})
