import { describe, expect, it } from 'vitest'
import { MINUS, formatDelta, formatSignedDuration } from '@/lib/formatters'

describe('formatDelta', () => {
  it('uses a real minus, not a hyphen', () => {
    expect(formatDelta(-12)).toBe(`${MINUS}12`)
    expect(formatDelta(-12).includes('-')).toBe(false)
  })

  it('signs a rise with a plus', () => {
    expect(formatDelta(6)).toBe('+6')
  })

  it('leaves zero unsigned', () => {
    expect(formatDelta(0)).toBe('0')
  })

  it('puts one space before a unit', () => {
    expect(formatDelta(-295, 'km')).toBe(`${MINUS}295 km`)
    expect(formatDelta(2, 'bpm')).toBe('+2 bpm')
  })

  it('rounds away float noise rather than printing it', () => {
    expect(formatDelta(0.1 + 0.2)).toBe('+0.3')
  })
})

describe('formatSignedDuration', () => {
  it('renders a time delta as m:ss, not a bare second count', () => {
    expect(formatSignedDuration(-332)).toBe(`${MINUS}5:32`)
    expect(formatSignedDuration(332)).toBe('+5:32')
  })

  it('carries hours when the delta is large enough', () => {
    expect(formatSignedDuration(3661)).toBe('+1:01:01')
  })

  it('accepts a unit for per-km deltas', () => {
    expect(formatSignedDuration(-56, '/km')).toBe(`${MINUS}0:56 /km`)
  })

  it('leaves zero unsigned', () => {
    expect(formatSignedDuration(0)).toBe('0:00')
  })
})
