import { describe, expect, it } from 'vitest'
import { RUN_TYPE_ZONE, runTypeColor } from '@/lib/colors'

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
