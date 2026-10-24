import { describe, it, expect } from 'vitest'
import { compassPoint } from '../weather'

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
