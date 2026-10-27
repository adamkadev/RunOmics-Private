import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MINUS, formatClock, formatDeltaFixed, formatDistance, formatDurationRounded, formatKm } from '../formatters'

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
  it('rounds before it splits, so a minute never has sixty seconds', () => {
    expect(formatClock(299.6)).toBe('5:00')
    expect(formatClock(1199.5)).toBe('20:00')
  })
})

describe('formatDurationRounded', () => {
  it('keeps the seconds under an hour', () => {
    expect(formatDurationRounded(1334)).toEqual({ value: '22:14', unit: 'min' })
    expect(formatDurationRounded(3599.4)).toEqual({ value: '59:59', unit: 'min' })
  })

  it('writes an hour or more to the minute', () => {
    expect(formatDurationRounded(3999)).toEqual({ value: '1:07', unit: 'h' })
    expect(formatDurationRounded(3600)).toEqual({ value: '1:00', unit: 'h' })
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

  it('writes a distance with the decimal comma', () => {
    expect(fr.formatDistance(9.26)).toBe('9,3')
    expect(fr.formatDistance(12.34)).toBe('12,3')
  })

  it('writes a fixed-precision delta the same way', () => {
    expect(fr.formatDeltaFixed(-1.44, 1)).toBe(`${MINUS}1,4`)
  })

  it('groups thousands with a no-break space, so a total never wraps', () => {
    expect(fr.formatKm(2684)).toBe('2\u00a0684')
    expect(fr.formatNumber(1306.5)).toBe('1\u00a0306,5')
  })

  it('keeps the per cent sign on the line of its number', () => {
    expect(fr.formatPercent(45)).toBe('45\u00a0%')
  })

  it('keeps a date spaced with U+0020', () => {
    expect(fr.formatDate('2026-09-06', { year: 'never' })).not.toContain('\u00a0')
  })

  it('leaves the English build as it was', () => {
    expect(formatKm(2684)).toBe('2,684')
    expect(formatKm(1306)).toBe('1,306')
    expect(formatDistance(9.26)).toBe('9.3')
  })
})

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

// A component calling toLocaleString itself skips stableSpaces and drifts from the rest.
describe('number formatting', () => {
  it('goes through lib/formatters in every component', () => {
    const offenders = sources(join(process.cwd(), 'src', 'components')).filter((file) => /\.toLocaleString\(/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  // toFixed always writes a point: a figure on screen goes through formatDecimal, and toFixed stays
  // for SVG paths, CSS percents and cache keys.
  it('never renders a toFixed figure as text', () => {
    const offenders = sources(join(process.cwd(), 'src', 'components')).filter((file) =>
      /(?<![$=])\{[^{}]*\.toFixed\(\d\)\}/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
