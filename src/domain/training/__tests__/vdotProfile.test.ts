import { describe, expect, it } from 'vitest'
import { vdotProfile, type VdotRecordInput } from '../vdotProfile'

const DISTANCES = [
  { key: '1k', km: 1 },
  { key: '1mile', km: 1.60934 },
  { key: '5k', km: 5 },
  { key: '10k', km: 10 },
  { key: 'half', km: 21.0975 },
  { key: 'marathon', km: 42.195 },
]

const rec = (key: string, km: number, seconds: number, date: string | null = '2026-10-01'): VdotRecordInput => ({ key, km, seconds, date })

describe('vdotProfile', () => {
  it('returns null with fewer than two records from 1.5 km up', () => {
    expect(vdotProfile([rec('1k', 1, 200), rec('5k', 5, 1200)], DISTANCES, '2026-11-21')).toBeNull()
  })

  it('orders rows by distance and picks the highest VDOT as best', () => {
    const p = vdotProfile([rec('half', 21.0975, 6000), rec('5k', 5, 1200), rec('10k', 10, 2640)], DISTANCES, '2026-11-21')!
    expect(p.rows.map((r) => r.key)).toEqual(['5k', '10k', 'half'])
    expect(p.best.key).toBe('5k')
    expect(p.best.vdot).toBeCloseTo(49.8, 1)
  })

  it('reads a speed lead when the short records sit more than 2 VDOT above the long ones', () => {
    const p = vdotProfile([rec('5k', 5, 1200), rec('10k', 10, 2640), rec('half', 21.0975, 6000)], DISTANCES, '2026-11-21')!
    expect(p.lead).toBe('speed')
    expect(p.gap).toBe(3)
  })

  it('reads an endurance lead when the long records lead', () => {
    const p = vdotProfile([rec('5k', 5, 1320), rec('half', 21.0975, 5700)], DISTANCES, '2026-11-21')!
    expect(p.lead).toBe('endurance')
  })

  it('reads even within 2 VDOT, or when one side has no record', () => {
    expect(vdotProfile([rec('5k', 5, 1200), rec('10k', 10, 2490)], DISTANCES, '2026-11-21')!.lead).toBe('even')
    expect(vdotProfile([rec('10k', 10, 2490), rec('half', 21.0975, 6000)], DISTANCES, '2026-11-21')!.lead).toBe('even')
  })

  it('names the trailing records older than six months', () => {
    const p = vdotProfile([rec('5k', 5, 1200, '2026-11-01'), rec('10k', 10, 2640, '2026-04-02'), rec('half', 21.0975, 6000, '2026-10-01')], DISTANCES, '2026-11-21')!
    expect(p.staleTrailing.map((r) => r.key)).toEqual(['10k'])
  })

  it('never marks a record without a date as stale', () => {
    const p = vdotProfile([rec('5k', 5, 1200), rec('10k', 10, 2640, null)], DISTANCES, '2026-11-21')!
    expect(p.staleTrailing).toEqual([])
  })

  it('gives the worth at the best VDOT for each longer distance it beats, missing records included', () => {
    const p = vdotProfile([rec('5k', 5, 1200), rec('10k', 10, 2640), rec('half', 21.0975, 6000)], DISTANCES, '2026-11-21')!
    expect(p.equivalents.map((e) => e.key)).toEqual(['10k', 'half', 'marathon'])
    const tenK = p.equivalents[0]!
    expect(tenK.seconds).toBe(2640)
    expect(tenK.worthSeconds).toBeGreaterThan(2460)
    expect(tenK.worthSeconds).toBeLessThan(2520)
    expect(p.equivalents[2]!.seconds).toBeNull()
  })

  it('works the equivalents out at the best recent record, not an older faster one', () => {
    const p = vdotProfile([rec('1mile', 1.60934, 340, '2025-11-01'), rec('5k', 5, 1200, '2026-11-01'), rec('10k', 10, 2640, '2026-10-01')], DISTANCES, '2026-11-21')!
    expect(p.best.key).toBe('1mile')
    expect(p.anchor.key).toBe('5k')
    expect(p.equivalents.map((e) => e.key)).toEqual(['10k', 'half', 'marathon'])
  })

  it('anchors on the best record when every record is old', () => {
    const p = vdotProfile([rec('5k', 5, 1200, '2025-01-01'), rec('10k', 10, 2640, '2025-01-01')], DISTANCES, '2026-11-21')!
    expect(p.anchor.key).toBe('5k')
  })

  it('never offers a worth slower than the record it stands beside', () => {
    const p = vdotProfile([rec('1mile', 1.60934, 345), rec('5k', 5, 1203), rec('10k', 10, 2466)], DISTANCES, '2026-11-21')!
    for (const e of p.equivalents) if (e.seconds !== null) expect(e.worthSeconds).toBeLessThan(e.seconds)
  })
})
