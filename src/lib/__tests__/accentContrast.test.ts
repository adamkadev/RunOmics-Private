import { describe, it, expect } from 'vitest'
import { ACCENT_IDS, ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT, CURATED_ACCENTS, DEFAULT_ACCENT, type AccentId } from '@/lib/accent'
import { TOKEN_BLOCKS, accentTokens, readableOn } from '@/lib/themeTokens'
import { contrastRatio } from '@/lib/oklch'
import { STATUS_HEX, SURFACES } from '@/lib/themeTokens'
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

// WCAG contrast cannot tell an accent from --destructive: two hues can differ wildly and share a
// luminance, so compare perceptual distance instead.
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

// From TOKEN_BLOCKS, not ACCENT_IDS: the blocks are what ships as CSS, registered as an accent or not.
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

  // --destructive is var(--neg): the danger signal is the neg status.
  it.each(cases)('$mode accent "$id" is distinguishable from --neg', ({ mode, selector, base }) => {
    const accent = resolved(selector, base, '--accent')
    expect(accent, 'accent token').toBeDefined()
    expect(resolved(selector, base, '--destructive')).toBe('var(--neg)')

    expect(deltaE(accent!, STATUS_HEX[mode as 'dark' | 'light'].neg)).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })
})

/** `color-mix(in srgb, fg share%, transparent)` laid over `bg`. */
function tint(fg: string, bg: string, share: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16)
  return `#${[1, 3, 5].map((i) => Math.round(channel(fg, i) * share + channel(bg, i) * (1 - share)).toString(16).padStart(2, '0')).join('')}`
}

// A missed day's "✕ 10 km" on Month sits on the neg status at 12 % over the card.
describe('missed text', () => {
  it.each(['dark', 'light'] as const)('reads at 4.5:1 or more on its own tint, %s', (mode) => {
    const neg = STATUS_HEX[mode].neg
    expect(contrast(neg, tint(neg, SURFACES[mode].card, 0.12))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(neg, SURFACES[mode].card)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('screen audit contrast floors', () => {
  it.each(['dark', 'light'] as const)('faint text reads at 4.5:1 or more on the card and the ground, %s', (mode) => {
    const s = SURFACES[mode]
    expect(contrast(s.subtle, s.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(s.subtle, s.background)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['dark', 'light'] as const)('warn text reads at 4.5:1 or more on the card, %s', (mode) => {
    expect(contrast(STATUS_HEX[mode].warn, SURFACES[mode].card)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['dark', 'light'] as const)('a reference series reads at 3:1 or more on the card, %s', (mode) => {
    expect(contrast(SURFACES[mode].band, SURFACES[mode].card)).toBeGreaterThanOrEqual(3)
  })

  it.each(['dark', 'light'] as const)('the selected tab stands apart from its track, %s', (mode) => {
    const s = SURFACES[mode]
    expect(contrast(s.pill, s.seg)).toBeGreaterThanOrEqual(1.05)
    // In dark the pill is raised, lighter than the track it sits on.
    if (mode === 'dark') expect(luminance(s.pill)).toBeGreaterThan(luminance(s.seg))
  })
})

// Light --accent-text is the accent a step darker (readableOn), to clear 4.5:1 on a card, the ground
// and an inset tile; fills keep the accent itself.
describe('light theme text on its surfaces', () => {
  const s = SURFACES.light
  const grounds = { card: s.card, ground: s.background, tile: s.seg }

  it.each(Object.entries(grounds))('amber (warn) text reads at 4.5:1 or more on the %s', (_, ground) => {
    expect(contrastRatio(STATUS_HEX.light.warn, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(
    CURATED_ACCENTS.flatMap((accent) =>
      Object.entries(grounds).map(([name, ground]) => ({ id: accent.id, name, ground, text: accentTokens(accent, 'light')['--accent-text']! })),
    ),
  )('$id accent text reads at 4.5:1 or more on the $name', ({ text, ground }) => {
    expect(contrastRatio(text, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it('darkens only an accent that needs it, and only the text', () => {
    const teal = CURATED_ACCENTS.find((accent) => accent.id === 'teal')!
    const violet = CURATED_ACCENTS.find((accent) => accent.id === 'violet')!
    expect(accentTokens(teal, 'light')['--accent-text']).not.toBe(teal.light.acc)
    expect(accentTokens(teal, 'light')['--accent']).toBe(teal.light.acc)
    expect(accentTokens(violet, 'light')['--accent-text']).toBe(violet.light.acc)
    expect(readableOn('#1a1c1b', s.seg)).toBe('#1a1c1b')
  })
})
