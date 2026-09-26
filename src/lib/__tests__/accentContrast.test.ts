import { describe, it, expect } from 'vitest'
import { ACCENT_IDS, ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT, CURATED_ACCENTS, DEFAULT_ACCENT, type AccentId } from '@/lib/accent'
import { TOKEN_BLOCKS } from '@/lib/themeTokens'
import { SURFACES } from '@/lib/themeTokens'
import { white } from '@/lib/palette'

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

function contrast(fg: string, bg: string): number {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05)
}

const DARK_BG = SURFACES.dark.background
const LIGHT_BG = white

describe('accent palette contrast', () => {
  // v4.3: the ink on a selected state passes 4.5:1 for every accent.
  it.each(CURATED_ACCENTS.flatMap((a) => (['dark', 'light'] as const).map((mode) => ({ id: a.id, mode, ...a[mode] }))))(
    '$mode $id: on-accent ink on the accent is >= 4.5:1',
    ({ acc, onAcc }) => {
      expect(contrast(onAcc, acc)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(ACCENT_IDS)('dark-mode accent "%s" has >= 3:1 contrast on the dark background', (id) => {
    expect(contrast(ACCENT_SWATCHES[id], DARK_BG)).toBeGreaterThanOrEqual(3)
  })

  it.each(ACCENT_IDS)('light-mode accent "%s" has >= 3:1 contrast on white', (id) => {
    expect(contrast(ACCENT_SWATCHES_LIGHT[id], LIGHT_BG)).toBeGreaterThanOrEqual(3)
  })
})

// The `impact` theme shipped a rose --accent alongside a red --destructive only
// 10.5 dE76 apart, so a "go" button and a delete button were the same colour.
// WCAG contrast cannot catch this - two hues can differ wildly and still share a
// luminance - so compare perceptual distance instead.
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deltaE(a: string, b: string): number {
  const [la, aa, ba] = lab(a)
  const [lb, ab, bb] = lab(b)
  return Math.hypot(la - lb, aa - ab, ba - bb)
}

function tokensFor(selector: string): Record<string, string> {
  return TOKEN_BLOCKS.filter((b) => b.selector === selector).reduce(
    (all, b) => ({ ...all, ...b.tokens }),
    {} as Record<string, string>,
  )
}

function resolved(selector: string, base: string, token: string): string | undefined {
  return tokensFor(selector)[token] ?? tokensFor(base)[token]
}

const MIN_DELTA_E = 30

// Derived from TOKEN_BLOCKS rather than ACCENT_IDS: the blocks are what actually
// ships as CSS, so a variant that is added here but never registered as a
// selectable accent is still covered.
function accentCases() {
  const seen = new Map<string, { id: string; mode: string; selector: string; base: string }>()
  for (const block of TOKEN_BLOCKS) {
    const match = /^(\.dark)?\[data-accent="([^"]+)"\]$/.exec(block.selector)
    if (!match) continue
    const dark = match[1] === '.dark'
    seen.set(block.selector, {
      id: match[2]!,
      mode: dark ? 'dark' : 'light',
      selector: block.selector,
      base: dark ? '.dark' : ':root',
    })
  }
  return [...seen.values()]
}

describe('accent never collides with the danger signal', () => {
  const cases = accentCases()

  it('covers every shipped accent in both modes', () => {
    expect(cases).toHaveLength(ACCENT_IDS.filter((id: AccentId) => id !== DEFAULT_ACCENT).length * 2)
  })

  it.each(cases)('$mode accent "$id" is distinguishable from --destructive', ({ selector, base }) => {
    const accent = resolved(selector, base, '--accent')
    const destructive = resolved(selector, base, '--destructive')
    expect(accent, 'accent token').toBeDefined()
    expect(destructive, 'destructive token').toBeDefined()

    expect(deltaE(accent!, destructive!)).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })
})
