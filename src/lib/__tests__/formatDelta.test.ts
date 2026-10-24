import { describe, expect, it } from 'vitest'
import { MINUS, formatDelta } from '@/lib/formatters'

describe('formatDelta', () => {
  it('uses a real minus, not a hyphen', () => {
    expect(formatDelta(-12)).toBe(`${MINUS}12`)
    expect(formatDelta(-12).includes('-')).toBe(false)
  })

  it('signs a rise with a plus', () => {
    expect(formatDelta(6)).toBe('+6')
  })

  it('marks a measured-but-flat reading, so it cannot read as "no data"', () => {
    expect(formatDelta(0)).toBe('±0')
    expect(formatDelta(0, 'bpm')).toBe('±0 bpm')
  })

  it('puts one space before a unit', () => {
    expect(formatDelta(-295, 'km')).toBe(`${MINUS}295 km`)
    expect(formatDelta(2, 'bpm')).toBe('+2 bpm')
  })

  it('rounds away float noise rather than printing it', () => {
    expect(formatDelta(0.1 + 0.2)).toBe('+0.3')
  })
})
