import { describe, expect, it } from 'vitest'
import { temperatureColor } from '@/lib/colors'

describe('temperatureColor', () => {
  it('returns the cold color below 5 degrees', () => {
    expect(temperatureColor(0)).toBe('text-blue-600 dark:text-blue-400')
  })

  it('returns the neutral accent color in the temperate range', () => {
    expect(temperatureColor(15)).toBe('text-accent-text')
  })

  it('returns the hot color at and above 30 degrees', () => {
    expect(temperatureColor(30)).toBe('text-red-600 dark:text-red-400')
  })

  it('treats range boundaries as belonging to the upper bucket', () => {
    expect(temperatureColor(5)).toBe('text-cyan-600 dark:text-cyan-400')
    expect(temperatureColor(12)).toBe('text-accent-text')
    expect(temperatureColor(18)).toBe('text-amber-600 dark:text-amber-400')
    expect(temperatureColor(24)).toBe('text-orange-600 dark:text-orange-400')
  })

  it('bands every hue on the text-grade ramp, since the ink is the reading', () => {
    for (const celsius of [0, 8, 20, 26, 33]) {
      expect(temperatureColor(celsius)).not.toContain('-500')
    }
  })
})
