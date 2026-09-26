import { describe, expect, it } from 'vitest'
import { CURATED_ACCENTS } from '@/lib/accentScale'
import { TOKEN_BLOCKS, accentTokens } from '@/lib/themeTokens'
import { TRAINING_METRIC_COLORS, ZONE_COLOR_CLASSES } from '@/lib/colors'
import { STATUS } from '@/lib/statusColors'
import { milestoneDotClass } from '@/components/milestones/milestoneVisuals'

/**
 * What an accent is allowed to paint. The accent owns links, selected states,
 * the week ring, progress fills and the tab bar's active item; it owns no
 * meaning. Adding a semantic token to accentTokens - a metric, a zone, the
 * injury red, the heat ramp - fails here rather than in someone's eyes.
 */
const ACCENT_TOKEN_NAMES = [
  '--accent',
  '--accent-foreground',
  '--accent-text',
  '--accent-hover',
  // v4.3: the tab bar's active pill, and the one hero card's border.
  '--acc-soft',
  '--acc-line',
  '--ring',
]

const SEMANTIC_PREFIXES = ['--metric-', '--zone-', '--delta-', '--destructive', '--color-missed']

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
    // The metric and zone ramps live in the base blocks and no accent block
    // redeclares them, so switching accent cannot move them.
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
  // The accent owns links, selected states, the week ring, progress fills and
  // the active tab item. A medal rank, an injury, a caution, a metric or a zone
  // means the same thing on every theme, so none of them may read the token.
  const FIXED_MARKERS = {
    'medal gold': STATUS.gold.dot,
    'medal silver': STATUS.silver.dot,
    'medal bronze': STATUS.bronze.dot,
    'milestone record dot': milestoneDotClass('record'),
    'Form': TRAINING_METRIC_COLORS.form,
    'Fitness': TRAINING_METRIC_COLORS.fitness,
    'Fatigue': TRAINING_METRIC_COLORS.fatigue,
    ...Object.fromEntries(
      Object.entries(ZONE_COLOR_CLASSES).map(([zone, classes]) => [`zone ${zone}`, classes.bg]),
    ),
  }

  it.each(Object.entries(FIXED_MARKERS))('%s does not draw from the accent', (_name, value) => {
    expect(value).not.toMatch(/accent/)
  })

  it('gives a record the same gold in Milestones as in Records', () => {
    expect(milestoneDotClass('record')).toBe(STATUS.gold.dot)
  })

  it('leaves every other milestone type unmarked, which is the point', () => {
    for (const type of ['distance-tier', 'streak', 'lifetime-distance', 'activity-count', 'first-activity'] as const) {
      expect(milestoneDotClass(type)).toBeNull()
    }
  })
})

describe('the generated accent blocks', () => {
  it('paint the five v4.3 palettes', () => {
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
  // Colour is for data and the active state: every accent shares one set of
  // surfaces, flat, and paints none of them.
  const SURFACE_TOKENS = ['--background', '--canvas', '--card', '--raised', '--border', '--divider', '--glass-bg', '--glass-bg-nav', '--hero-gradient']

  it('lets no accent block set a surface', () => {
    for (const block of TOKEN_BLOCKS.filter((b) => b.selector.includes('data-accent'))) {
      for (const name of SURFACE_TOKENS) expect(block.tokens[name], `${block.selector} ${name}`).toBeUndefined()
    }
  })

  it('draws the spec surfaces, flat, in both modes', () => {
    const light = TOKEN_BLOCKS.find((b) => b.comment?.startsWith('Light tokens'))!.tokens
    const dark = TOKEN_BLOCKS.find((b) => b.comment?.startsWith('Dark tokens'))!.tokens
    // The v4.3 table: --bg, --card, --seg, --line, --fa, --band, --amb.
    expect([dark['--background'], dark['--card'], dark['--segmented-track'], dark['--border'], dark['--track'], dark['--band'], dark['--tone-caution']]).toEqual(['#0b0c0c', '#161818', '#1d2020', '#252828', '#262a2a', '#3a3f3f', '#f5b83d'])
    expect([light['--background'], light['--card'], light['--segmented-track'], light['--border'], light['--track'], light['--band'], light['--tone-caution']]).toEqual(['#f3f4f4', '#ffffff', '#e6e8e8', '#e4e6e6', '#e8eaea', '#c9cdcd', '#b45309'])
    for (const tokens of [light, dark]) {
      expect(tokens['--canvas']).toBe(tokens['--background'])
      for (const value of Object.values(tokens)) expect(value).not.toMatch(/gradient\(/)
    }
  })
})
