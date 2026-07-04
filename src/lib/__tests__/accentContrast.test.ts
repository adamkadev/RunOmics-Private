import { describe, it, expect } from 'vitest'
import { ACCENT_IDS, ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT } from '@/lib/accent'

// WCAG 2.1 relative luminance + contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (l1 + 0.05) / (l2 + 0.05)
}

// The accent palette is fixed, so contrast can be guaranteed by test instead
// of a runtime picker validation: every accent must stay readable as a UI
// color (WCAG 1.4.11 non-text contrast, ratio >= 3:1) on its theme background.
const DARK_BG = '#06091a'
const LIGHT_BG = '#ffffff'

describe('accent palette contrast', () => {
  it.each(ACCENT_IDS)('dark-mode accent "%s" has >= 3:1 contrast on the dark background', (id) => {
    expect(contrast(ACCENT_SWATCHES[id], DARK_BG)).toBeGreaterThanOrEqual(3)
  })

  it.each(ACCENT_IDS)('light-mode accent "%s" has >= 3:1 contrast on white', (id) => {
    expect(contrast(ACCENT_SWATCHES_LIGHT[id], LIGHT_BG)).toBeGreaterThanOrEqual(3)
  })
})
