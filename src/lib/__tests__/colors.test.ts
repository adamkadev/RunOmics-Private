import { describe, expect, it } from 'vitest'
import { RUN_TYPE_ZONE, runTypeColor, temperatureColor } from '@/lib/colors'

describe('temperatureColor', () => {
  it('returns the cold color below 5 degrees', () => {
    expect(temperatureColor(0)).toBe('text-blue-600 dark:text-blue-400')
  })

  // The band used to be the accent. A temperature is a fixed reading, and this
  // ramp runs cold-blue to hot-red through it, so on a violet or teal accent
  // the middle of the scale stopped belonging to the scale.
  it('returns a fixed green in the temperate range, not the accent', () => {
    expect(temperatureColor(15)).toBe('text-emerald-600 dark:text-emerald-400')
    expect(temperatureColor(15)).not.toContain('accent')
  })

  it('returns the hot color at and above 30 degrees', () => {
    expect(temperatureColor(30)).toBe('text-red-600 dark:text-red-400')
  })

  it('treats range boundaries as belonging to the upper bucket', () => {
    expect(temperatureColor(5)).toBe('text-cyan-600 dark:text-cyan-400')
    expect(temperatureColor(12)).toBe('text-emerald-600 dark:text-emerald-400')
    expect(temperatureColor(18)).toBe('text-amber-600 dark:text-amber-400')
    expect(temperatureColor(24)).toBe('text-orange-600 dark:text-orange-400')
  })

  it('bands every hue on the text-grade ramp, since the ink is the reading', () => {
    for (const celsius of [0, 8, 20, 26, 33]) {
      expect(temperatureColor(celsius)).not.toContain('-500')
    }
  })
})

describe('RUN_TYPE_ZONE', () => {
  // Threshold was salmon on one day and orange on the next, and salmon also
  // meant Z5, heart rate and "destructive". A type is now the zone it targets.
  it('maps each run type to the zone it targets', () => {
    expect(RUN_TYPE_ZONE).toEqual({ Sprint: 5, Anaerobic: 5, VO2Max: 5, Threshold: 4, Tempo: 3, Base: 2, Race: 5 })
  })

  it('draws a type in its zone token', () => {
    expect(runTypeColor('Threshold')).toBe('var(--zone-4)')
    expect(runTypeColor('Tempo')).toBe('var(--zone-3)')
  })

  it('draws a type it does not know as Base', () => {
    expect(runTypeColor('HillRepeats')).toBe('var(--zone-2)')
    expect(runTypeColor(undefined)).toBe('var(--zone-2)')
  })
})
