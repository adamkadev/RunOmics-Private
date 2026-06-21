import { describe, expect, it } from 'vitest'
import { temperatureIconColor } from '@/lib/colors'

describe('temperatureIconColor', () => {
  it('returns the cold color below 5 degrees', () => {
    expect(temperatureIconColor(0)).toBe('text-blue-500 dark:text-blue-400')
  })

  it('returns the neutral accent color in the temperate range', () => {
    expect(temperatureIconColor(15)).toBe('text-accent-text')
  })

  it('returns the hot color at and above 30 degrees', () => {
    expect(temperatureIconColor(30)).toBe('text-red-500 dark:text-red-400')
  })

  it('treats range boundaries as belonging to the upper bucket', () => {
    expect(temperatureIconColor(5)).toBe('text-cyan-500 dark:text-cyan-400')
    expect(temperatureIconColor(12)).toBe('text-accent-text')
    expect(temperatureIconColor(18)).toBe('text-amber-500 dark:text-amber-400')
    expect(temperatureIconColor(24)).toBe('text-orange-500 dark:text-orange-400')
  })
})
