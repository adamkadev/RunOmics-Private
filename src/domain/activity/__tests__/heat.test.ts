import { describe, it, expect } from 'vitest'
import { heatPenalty, heatAdjustedEf, HEAT_NEUTRAL_C } from '../heat'
import type { ActivityWeather } from '../types'

const weather = (apparentTempC: number): ActivityWeather => ({
  tempC: apparentTempC,
  apparentTempC,
  humidityPct: 60,
  windKph: 5,
  windDirDeg: 180,
  precipitationMm: 0,
  code: 0,
})

describe('heatPenalty', () => {
  it('costs nothing at or below the neutral temperature', () => {
    expect(heatPenalty(HEAT_NEUTRAL_C)).toBe(0)
    expect(heatPenalty(2)).toBe(0)
    expect(heatPenalty(-8)).toBe(0)
  })

  it('charges 0.5% per degree over the first 10 degrees', () => {
    expect(heatPenalty(20)).toBeCloseTo(0.025, 5)
    expect(heatPenalty(25)).toBeCloseTo(0.05, 5)
  })

  it('doubles the slope past 25 degrees', () => {
    expect(heatPenalty(30)).toBeCloseTo(0.1, 5)
    expect(heatPenalty(35)).toBeCloseTo(0.15, 5)
  })
})

describe('heatAdjustedEf', () => {
  it('leaves a neutral-weather run untouched', () => {
    expect(heatAdjustedEf(1.2, weather(12))).toBe(1.2)
  })

  it('lifts a hot run back to what it would have been at 15 degrees', () => {
    expect(heatAdjustedEf(1.0, weather(25))).toBeCloseTo(1.05, 5)
  })

  it('falls back to the raw value when the run has no weather', () => {
    expect(heatAdjustedEf(1.13, null)).toBe(1.13)
  })
})
