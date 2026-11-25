import { describe, expect, it } from 'vitest'
import { medianStart, usualStart } from '../home'

const DOOR: [number, number] = [-150, 0]
const near = (dLon: number, dLat: number): [number, number] => [DOOR[0] + dLon, DOOR[1] + dLat]

describe('usualStart', () => {
  it('is where most runs set off, not the middle of every start', () => {
    const starts = [near(0, 0), near(0.0005, 0), near(0, 0.0005), near(0.03, 0), near(0.04, 0), near(0.05, 0), near(0.06, 0)]
    const usual = usualStart(starts)!
    expect(usual[0]).toBeCloseTo(DOOR[0], 3)
    expect(usual[1]).toBeCloseTo(DOOR[1], 3)
    expect(medianStart(starts)).not.toEqual(usual)
  })

  it('takes the busier of two places even when it lies to one side', () => {
    const starts = [near(0.02, 0), near(0.02, 0.0003), near(0.0203, 0), near(0, 0), near(0, 0.0003)]
    expect(usualStart(starts)![0]).toBeCloseTo(DOOR[0] + 0.02, 3)
  })

  it('skips points that are not numbers and is null with none left', () => {
    expect(usualStart([[Number.NaN, 0], DOOR])).toEqual(DOOR)
    expect(usualStart([])).toBeNull()
    expect(usualStart([[Number.NaN, Number.NaN]])).toBeNull()
  })
})
