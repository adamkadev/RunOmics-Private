import { describe, expect, it } from 'vitest'
import { CURATED_ACCENTS } from '@/lib/accentScale'
import { TOKEN_BLOCKS, accentTokens } from '@/lib/themeTokens'
import { STATUS } from '@/lib/statusColors'
import { milestoneIcon } from '@/components/milestones/milestoneVisuals'

/** The accent owns links, selected states, the week ring, progress fills and the active tab item; it owns no meaning. */
const ACCENT_TOKEN_NAMES = [
  '--accent',
  '--accent-foreground',
  '--accent-text',
  // 4.5:1 on the darkest light glass.
  '--accent-text-glass',
  '--accent-hover',
  // --acc-soft is the old name, still read.
  '--accent-soft',
  '--acc-soft',
  '--acc-line',
  '--ring',
]

const SEMANTIC_PREFIXES = ['--metric-', '--zone-', '--delta-', '--destructive', '--color-missed', '--pos', '--warn', '--neg']

describe('what an accent may paint', () => {
  it('emits the accent roles and nothing else, in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const accent of CURATED_ACCENTS) expect(Object.keys(accentTokens(accent, mode)).sort()).toEqual([...ACCENT_TOKEN_NAMES].sort())
    }
  })

  it('never emits a metric, a zone, a delta or the injury red', () => {
    for (const accent of CURATED_ACCENTS) {
      for (const mode of ['light', 'dark'] as const) {
        for (const name of Object.keys(accentTokens(accent, mode))) {
          for (const prefix of SEMANTIC_PREFIXES) {
            expect(name.startsWith(prefix), `${name} in ${accent.id}`).toBe(false)
          }
        }
      }
    }
  })

  it('leaves the semantic tokens identical whichever accent block is applied', () => {
    const accentSelectors = TOKEN_BLOCKS.filter((block) => block.selector.includes('data-accent'))
    expect(accentSelectors.length).toBeGreaterThan(0)
    for (const block of accentSelectors) {
      for (const name of Object.keys(block.tokens)) {
        for (const prefix of SEMANTIC_PREFIXES) {
          expect(name.startsWith(prefix), `${block.selector} sets ${name}`).toBe(false)
        }
      }
    }
  })

})

describe('markers that mean something do not move with the accent', () => {
  const FIXED_MARKERS = {
    'medal gold': STATUS.gold.dot,
    'medal silver': STATUS.silver.dot,
    'medal bronze': STATUS.bronze.dot,
  }

  it.each(Object.entries(FIXED_MARKERS))('%s does not draw from the accent', (_name, value) => {
    expect(value).not.toMatch(/accent/)
  })

  it('marks a record milestone in the warm amber, never the accent', () => {
    const record = milestoneIcon('record').className
    expect(record).toContain('var(--warn)')
    expect(record).not.toMatch(/accent/)
  })

  it('leaves every count, total and streak neutral', () => {
    for (const type of ['streak', 'lifetime-distance', 'activity-count', 'first-activity'] as const) {
      expect(milestoneIcon(type).className).not.toMatch(/accent|warn/)
    }
  })
})

describe('the generated accent blocks', () => {
  it('paint the five v4.17 palettes', () => {
    const curated = Object.fromEntries(
      CURATED_ACCENTS.map((accent) => [
        accent.id,
        { light: accentTokens(accent, 'light'), dark: accentTokens(accent, 'dark') },
      ]),
    )
    expect(curated).toMatchSnapshot()
  })

  it('ships a block for every curated accent except the one the base carries', () => {
    const selectors = new Set(TOKEN_BLOCKS.map((block) => block.selector))
    for (const { id } of CURATED_ACCENTS) {
      const generated = selectors.has(`[data-accent="${id}"]`)
      expect(generated, id).toBe(id !== CURATED_ACCENTS[0]!.id)
    }
  })
})

describe('neutral surfaces', () => {
  // Colour is for data and the active state: no accent paints a surface.
  const SURFACE_TOKENS = ['--background', '--canvas', '--card', '--raised', '--border', '--divider', '--glass-bg', '--glass-bg-nav', '--hero-gradient']

  it('lets no accent block set a surface', () => {
    for (const block of TOKEN_BLOCKS.filter((b) => b.selector.includes('data-accent'))) {
      for (const name of SURFACE_TOKENS) expect(block.tokens[name], `${block.selector} ${name}`).toBeUndefined()
    }
  })

  it('draws the spec surfaces, flat, in both modes', () => {
    const light = TOKEN_BLOCKS.find((b) => b.comment?.startsWith('Light tokens'))!.tokens
    const dark = TOKEN_BLOCKS.find((b) => b.comment?.startsWith('Dark tokens'))!.tokens
    // The design table's bg, surface, surface-2, line, line-2, text, text-2, muted, faint, warn.
    const table = (t: Record<string, string>) =>
      ['--background', '--card', '--surface-2', '--border', '--line-2', '--foreground', '--text-2', '--muted-foreground', '--subtle', '--warn'].map((k) => t[k])
    expect(table(dark)).toEqual(['#0b0c0c', '#141616', '#0f1111', '#232626', '#303432', '#f2f4f3', '#a3aaa7', '#8d9391', '#7f8482', '#f0b73c'])
    expect(table(light)).toEqual(['#f3f4f3', '#ffffff', '#f0f1f0', '#e4e6e5', '#d3d6d4', '#141615', '#434846', '#6b706e', '#6b706e', '#9a5b00'])
    // Dark's track is a lighter step than surface-2, as its inset tile is darker than the card.
    expect(light['--track']).toBe(light['--surface-2'])
    expect(dark['--track']).toBe('#262a29')
    for (const tokens of [light, dark]) {
      expect(tokens['--segmented-track']).toBe('var(--fill-3)')
      expect(tokens['--tone-caution']).toBe(tokens['--warn'])
    }
    // The content layer stays flat; only the glass chrome's specular rim is a gradient.
    for (const tokens of [light, dark]) {
      expect(tokens['--canvas']).toBe(tokens['--background'])
      for (const [key, value] of Object.entries(tokens)) {
        if (!key.startsWith('--glass-rim')) expect(value, key).not.toMatch(/gradient\(/)
      }
    }
  })
})
