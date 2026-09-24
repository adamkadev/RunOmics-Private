import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MINUS, formatClock, formatDeltaFixed, formatDistance } from '../formatters'

describe('formatDeltaFixed', () => {
  it('keeps the precision it is given', () => {
    expect(formatDeltaFixed(5, 1)).toBe('+5.0')
    expect(formatDeltaFixed(4.64, 1)).toBe('+4.6')
  })

  it('signs a fall with a real minus, not a hyphen', () => {
    expect(formatDeltaFixed(-1.44, 1)).toBe(`${MINUS}1.4`)
    expect(formatDeltaFixed(-1.44, 1)).not.toContain('-')
  })

  it('marks a flat reading, however it was rounded to it', () => {
    expect(formatDeltaFixed(0.04, 1)).toBe('±0.0')
    expect(formatDeltaFixed(-0.04, 1)).toBe('±0.0')
  })
})

describe('formatClock', () => {
  // The race predictor's pace axis had its own copy, which rounded the seconds
  // after splitting off the minutes: 299.6 s printed as "4:60".
  it('rounds before it splits, so a minute never has sixty seconds', () => {
    expect(formatClock(299.6)).toBe('5:00')
    expect(formatClock(1199.5)).toBe('20:00')
  })
})

describe('in the French build', () => {
  let fr: typeof import('../formatters')

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE', 'fr')
    vi.resetModules()
    fr = await import('../formatters')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // toFixed always wrote a point, so a run read "9.26" beside a total of
  // "1 321,5" on the same screen.
  it('writes a distance with the decimal comma', () => {
    expect(fr.formatDistance(9.26)).toBe('9,26')
    expect(fr.formatDistance(12.34)).toBe('12,3')
  })

  it('writes a fixed-precision delta the same way', () => {
    expect(fr.formatDeltaFixed(-1.44, 1)).toBe(`${MINUS}1,4`)
  })

  it('leaves the English build as it was', () => {
    expect(formatDistance(9.26)).toBe('9.26')
  })
})
