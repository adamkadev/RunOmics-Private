import { describe, expect, it } from 'vitest'
import { formatDate, formatDateRange, formatKm } from '@/lib/formatters'

// Node's ICU puts U+2009 around a range dash where Chrome puts U+0020, and the mismatch makes React
// discard the subtree on hydration: these lock the output to characters both engines agree on.
const EXOTIC_SPACE = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/

describe('date output is byte-stable across ICU builds', () => {
  it('spaces a range with U+0020, not a thin space', () => {
    const range = formatDateRange('2026-08-31', '2026-09-06')

    expect(range).not.toMatch(EXOTIC_SPACE)
    expect(range).toBe('Aug 31 – Sep 6')
    expect([...range].map((c) => c.charCodeAt(0))).toContain(0x0020)
    expect([...range].map((c) => c.charCodeAt(0))).not.toContain(0x2009)
  })

  it('leaves the en dash alone - only the spaces are normalised', () => {
    expect(formatDateRange('2026-08-31', '2026-09-06')).toContain('\u2013')
  })

  it('still lets ICU collapse a same-month range', () => {
    expect(formatDateRange('2026-09-03', '2026-09-06')).toBe('Sep 3 – 6')
  })

  it('carries no exotic space in a single date either', () => {
    for (const iso of ['2026-09-06', '2025-01-31']) {
      expect(formatDate(iso)).not.toMatch(EXOTIC_SPACE)
      expect(formatDate(iso, { style: 'full' })).not.toMatch(EXOTIC_SPACE)
      expect(formatDate(iso, { precision: 'month' })).not.toMatch(EXOTIC_SPACE)
    }
  })

  it('groups thousands with U+00A0 alone, where fr ICU builds disagree between U+202F and U+00A0', () => {
    expect(formatKm(1705).replace(/\u00a0/g, '')).not.toMatch(EXOTIC_SPACE)
    expect(formatKm(1705)).toMatch(/^(1705|1,705|1\u00a0705)$/)
  })
})
