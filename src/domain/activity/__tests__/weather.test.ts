import { describe, it, expect } from 'vitest'
import { compassPoint, weatherCondition } from '../weather'

describe('weatherCondition', () => {
  it('maps the clear-to-overcast codes', () => {
    expect(weatherCondition(0)).toBe('clear')
    expect(weatherCondition(1)).toBe('mainlyClear')
    expect(weatherCondition(2)).toBe('partlyCloudy')
    expect(weatherCondition(3)).toBe('overcast')
  })

  it('collapses intensity variants onto one condition', () => {
    expect(weatherCondition(51)).toBe('drizzle')
    expect(weatherCondition(55)).toBe('drizzle')
    expect(weatherCondition(61)).toBe('rain')
    expect(weatherCondition(65)).toBe('rain')
    expect(weatherCondition(80)).toBe('showers')
    expect(weatherCondition(82)).toBe('showers')
  })

  it('keeps freezing precipitation distinct from its liquid form', () => {
    expect(weatherCondition(56)).toBe('freezingDrizzle')
    expect(weatherCondition(66)).toBe('freezingRain')
  })

  it('maps thunderstorms with and without hail', () => {
    expect(weatherCondition(95)).toBe('thunderstorm')
    expect(weatherCondition(99)).toBe('thunderstorm')
  })

  it('returns null for a code outside the WMO table', () => {
    expect(weatherCondition(7)).toBeNull()
    expect(weatherCondition(-1)).toBeNull()
  })
})

describe('compassPoint', () => {
  it('maps the cardinal bearings', () => {
    expect(compassPoint(0)).toBe('n')
    expect(compassPoint(90)).toBe('e')
    expect(compassPoint(180)).toBe('s')
    expect(compassPoint(270)).toBe('w')
  })

  it('rounds to the nearest eighth', () => {
    expect(compassPoint(170)).toBe('s')
    expect(compassPoint(200)).toBe('s')
    expect(compassPoint(210)).toBe('sw')
    expect(compassPoint(22)).toBe('n')
    expect(compassPoint(23)).toBe('ne')
  })

  it('wraps back to north at the top of the circle', () => {
    expect(compassPoint(350)).toBe('n')
    expect(compassPoint(360)).toBe('n')
    expect(compassPoint(720)).toBe('n')
  })

  it('handles a negative bearing', () => {
    expect(compassPoint(-90)).toBe('w')
  })
})
