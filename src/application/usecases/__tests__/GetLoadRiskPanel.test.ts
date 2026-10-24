import { describe, it, expect } from 'vitest'
import {
  monotony,
  strain,
  rampRate,
  acwrZone,
  acwrFromPair,
  monotonyZone,
  strainZone,
  rampRateZone,
} from '../GetLoadRiskPanel'

describe('monotony', () => {
  it('null with fewer than 7 days of data', () => {
    expect(monotony([10, 20, 30])).toBeNull()
  })

  it('null when the week had zero load', () => {
    expect(monotony([0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })

  it('null when there is no variance (stdev = 0)', () => {
    expect(monotony([50, 50, 50, 50, 50, 50, 50])).toBeNull()
  })

  it('computes mean / stdev for a varied week', () => {
    const week = [30, 70, 30, 70, 30, 70, 50]
    expect(monotony(week)).toBeCloseTo(2.7, 1)
  })
})

describe('strain', () => {
  it('multiplies weekly load by monotony', () => {
    expect(strain(300, 1.5)).toBe(450)
  })
})

describe('rampRate', () => {
  it('is the CTL delta over the window', () => {
    expect(rampRate(45, 42)).toBe(3)
    expect(rampRate(40, 45)).toBe(-5)
  })
})

describe('acwrZone', () => {
  it('null passthrough when acwr is null', () => {
    expect(acwrZone(null)).toBeNull()
  })

  it('low below 0.8', () => {
    expect(acwrZone(0.5)).toBe('low')
  })

  it('safe between 0.8 and 1.3 inclusive', () => {
    expect(acwrZone(0.8)).toBe('safe')
    expect(acwrZone(1.0)).toBe('safe')
    expect(acwrZone(1.3)).toBe('safe')
  })

  it('caution between 1.3 and 1.5', () => {
    expect(acwrZone(1.4)).toBe('caution')
  })

  it('risk above 1.5', () => {
    expect(acwrZone(1.6)).toBe('risk')
  })
})

describe('acwrFromPair', () => {
  it('equals round(acute / chronic, 2)', () => {
    expect(acwrFromPair(412, 295)).toBe(Math.round((412 / 295) * 100) / 100)
    expect(acwrFromPair(412, 295)).toBe(1.4)
    expect(acwrZone(acwrFromPair(412, 295))).toBe('caution')
  })

  it('is null without a usable pair', () => {
    expect(acwrFromPair(412, 0)).toBeNull()
    expect(acwrFromPair(undefined, 295)).toBeNull()
    expect(acwrFromPair(412, null)).toBeNull()
  })
})

describe('monotonyZone', () => {
  it('null passthrough', () => {
    expect(monotonyZone(null)).toBeNull()
  })

  it('safe at or below 1.5', () => {
    expect(monotonyZone(1.0)).toBe('safe')
    expect(monotonyZone(1.5)).toBe('safe')
  })

  it('caution between 1.5 and 2', () => {
    expect(monotonyZone(1.8)).toBe('caution')
  })

  it('risk above 2', () => {
    expect(monotonyZone(2.1)).toBe('risk')
  })
})

describe('rampRateZone', () => {
  it('safe within +/-5', () => {
    expect(rampRateZone(3)).toBe('safe')
    expect(rampRateZone(-3)).toBe('safe')
  })

  it('caution between 5 and 8 in either direction', () => {
    expect(rampRateZone(6)).toBe('caution')
    expect(rampRateZone(-7)).toBe('caution')
  })

  it('risk beyond +/-8', () => {
    expect(rampRateZone(9)).toBe('risk')
    expect(rampRateZone(-10)).toBe('risk')
  })
})

describe('strainZone', () => {
  it('null when both inputs are null', () => {
    expect(strainZone(null, null)).toBeNull()
  })

  it('takes the worse of the two zones', () => {
    expect(strainZone('safe', 'risk')).toBe('risk')
    expect(strainZone('caution', 'safe')).toBe('caution')
    expect(strainZone('low', 'safe')).toBe('safe')
  })

  it('ignores a null input and uses the other', () => {
    expect(strainZone(null, 'caution')).toBe('caution')
  })
})
