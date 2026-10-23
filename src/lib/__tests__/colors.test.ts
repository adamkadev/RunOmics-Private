import { describe, expect, it } from 'vitest'
import { RUN_TYPE_ZONE, runTypeColor } from '@/lib/colors'

describe('RUN_TYPE_ZONE', () => {
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

/** Every delta, chip and bar the app calls good reads --pos, so this is the one place the rule can be held. */
describe('the status colours (3.0 override 2)', () => {
  it('calls good mint, never lime', async () => {
    const { STATUS_HEX } = await import('@/lib/themeTokens')
    expect(STATUS_HEX.dark.pos).toBe('#2dd4a7')
    expect(STATUS_HEX.dark.pos).not.toBe('#7fd13b')
    // Light is the same hue at text grade, not an olive.
    expect(STATUS_HEX.light.pos).toBe('#0f7a52')
  })

  it('keeps warning amber and bad coral', async () => {
    const { STATUS_HEX } = await import('@/lib/themeTokens')
    expect(STATUS_HEX.dark.warn).toBe('#f0b73c')
    expect(STATUS_HEX.dark.neg).toBe('#ff8a80')
  })
})
