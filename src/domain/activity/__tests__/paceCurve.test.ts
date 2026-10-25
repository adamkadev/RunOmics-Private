import { describe, expect, it } from 'vitest'
import { bestCurve, criticalSpeed, runBests, type CurvePoint } from '../paceCurve'

const model = (cs: number, dPrime: number): CurvePoint[] =>
  [180, 300, 600, 1200].map((seconds) => ({ seconds, metres: cs * seconds + dPrime, date: '2026-10-01' }))

describe('bestCurve', () => {
  it('takes the most metres each duration saw inside the window', () => {
    const runs = [
      runBests({ date: '2026-10-01', durationBests: { '30': 120, '60': 230 } })!,
      runBests({ date: '2026-10-08', durationBests: { '30': 110, '60': 240, '120': 470 } })!,
      runBests({ date: '2026-06-01', durationBests: { '30': 190 } })!,
    ]

    expect(bestCurve(runs, { start: '2026-09-01', end: '2026-10-31' })).toEqual([
      { seconds: 30, metres: 120, date: '2026-10-01' },
      { seconds: 60, metres: 240, date: '2026-10-08' },
      { seconds: 120, metres: 470, date: '2026-10-08' },
    ])
  })

  it('has nothing for a run synced before the bests were stored', () => {
    expect(runBests({ date: '2026-10-01', durationBests: undefined })).toBeNull()
    expect(runBests({ date: '2026-10-01', durationBests: { '45': 150 } })).toBeNull()
  })
})

describe('criticalSpeed', () => {
  it('recovers the speed and D′ that generated the bests', () => {
    const fit = criticalSpeed(model(4, 200))!

    expect(fit.metresPerSecond).toBeCloseTo(4, 6)
    expect(fit.dPrimeMetres).toBeCloseTo(200, 4)
    expect(fit.paceSecPerKm).toBeCloseTo(250, 4)
  })

  it('fits bests that wander a little off the line', () => {
    const points = model(3.9, 150).map((p, i) => ({ ...p, metres: p.metres + [4, -6, 5, -3][i]! }))

    expect(criticalSpeed(points)!.metresPerSecond).toBeCloseTo(3.9, 1)
  })

  it('refuses a test run beside easy efforts, a missing slot and a negative D′', () => {
    const uneven = [
      { seconds: 180, metres: 849, date: '' },
      { seconds: 300, metres: 1398, date: '' },
      { seconds: 600, metres: 2580, date: '' },
      { seconds: 1200, metres: 4570, date: '' },
    ]

    expect(criticalSpeed(uneven)).toBeNull()
    expect(criticalSpeed(model(4, 200).slice(1))).toBeNull()
    expect(criticalSpeed(model(4, -50))).toBeNull()
  })
})
