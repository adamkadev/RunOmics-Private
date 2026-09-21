import { describe, it, expect } from 'vitest'
import { formVerdict, projectLoad, racePhase } from '../taper'

describe('racePhase', () => {
  it.each([
    [60, 'build'],
    [29, 'build'],
    [28, 'sharpen'],
    [15, 'sharpen'],
    [14, 'taper'],
    [8, 'taper'],
    [7, 'raceWeek'],
    [0, 'raceWeek'],
  ])('reads %i days out as %s', (days, phase) => {
    expect(racePhase(days)).toBe(phase)
  })
})

describe('projectLoad', () => {
  it('leaves the snapshot untouched over zero days', () => {
    expect(projectLoad({ ctl: 50, atl: 45, tsb: 5 }, 40, 0)).toEqual({ ctl: 50, atl: 45, tsb: 5 })
  })

  it('drives fatigue down faster than fitness when load drops', () => {
    const { ctl, atl, tsb } = projectLoad({ ctl: 50, atl: 50, tsb: 0 }, 0, 14)

    expect(atl).toBeLessThan(ctl)
    expect(tsb).toBeGreaterThan(0)
  })

  it('converges both curves toward a sustained load', () => {
    const { ctl, atl, tsb } = projectLoad({ ctl: 20, atl: 20, tsb: 0 }, 60, 400)

    expect(ctl).toBeCloseTo(60, 0)
    expect(atl).toBeCloseTo(60, 0)
    expect(tsb).toBeCloseTo(0, 0)
  })

  it('holds form flat when the current load is already the sustained one', () => {
    expect(projectLoad({ ctl: 40, atl: 40, tsb: 0 }, 40, 30)).toEqual({ ctl: 40, atl: 40, tsb: 0 })
  })
})

describe('formVerdict', () => {
  it.each([
    [-10, 'underRested'],
    [4.9, 'underRested'],
    [5, 'ready'],
    [25, 'ready'],
    [25.1, 'overRested'],
  ])('reads a TSB of %s as %s', (tsb, verdict) => {
    expect(formVerdict(tsb)).toBe(verdict)
  })
})
