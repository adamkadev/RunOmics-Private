import { describe, expect, it } from 'vitest'
import { ACTIVITY_TYPES, type ActivityType } from '@/domain/activity/types'
import { ACTIVITY_TYPE_STYLE } from '@/components/activity/activityTypeStyle'
import { CHART_COLORS, TRAINING_STATUS_COLORS } from '@/lib/colors'
import { ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT } from '@/lib/accent'
import { rgbTriplet } from '@/lib/palette'
import { TOKEN_BLOCKS } from '@/lib/themeTokens'

// A chart colour that is a token reads as its value in each theme.
const THEME_BLOCKS = TOKEN_BLOCKS.filter((b) => b.comment?.startsWith('Light tokens') || b.comment?.startsWith('Dark tokens'))
function resolved(value: string): string[] {
  const name = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  return name ? THEME_BLOCKS.map((b) => b.tokens[name]!) : [value]
}

/** Two colours in one hue family are two depths of one hue; grey-ish colours carry no hue and spend none. */
function hueFamily(hex: string): string {
  const [r255, g255, b255] = rgbTriplet(hex)
  const r = r255 / 255
  const g = g255 / 255
  const b = b255 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (chroma < 0.12) return 'neutral'
  let angle: number
  if (max === r) angle = ((g - b) / chroma) * 60
  else if (max === g) angle = ((b - r) / chroma) * 60 + 120
  else angle = ((r - g) / chroma) * 60 + 240
  angle = (angle + 360) % 360
  const bands: Array<[string, number]> = [
    ['red', 15], ['orange', 35], ['amber', 45], ['yellow', 65],
    ['lime', 90], ['green', 150], ['teal', 175], ['cyan', 195],
    ['sky', 210], ['blue', 250], ['violet', 280], ['fuchsia', 320],
    ['rose', 350],
  ]
  return bands.find(([, upper]) => angle < upper)?.[0] ?? 'red'
}

const TYPES = ACTIVITY_TYPES
const typeHue = (type: ActivityType) => ACTIVITY_TYPE_STYLE[type].chartColor

describe('activity type hue budget', () => {
  it('spends the zone families, and no other, across the seven types', () => {
    for (const block of THEME_BLOCKS) {
      const families = new Set(TYPES.map((type) => hueFamily(block.tokens[typeHue(type).slice(4, -1)]!)))
      const zones = new Set([2, 3, 4, 5].map((zone) => hueFamily(block.tokens[`--zone-${zone}`]!)))
      expect([...families].sort(), block.comment).toEqual([...zones].sort())
    }
  })

  it('never draws a type in the accent or a status colour (v4.17)', () => {
    // A type is a category: its zone, and nothing that means "yours" or
    // "good / caution / bad".
    for (const type of TYPES) {
      expect(typeHue(type), type).toMatch(/^var\(--zone-[1-5]\)$/)
      expect(Object.values(ACCENT_SWATCHES_LIGHT)).not.toContain(typeHue(type))
      expect(Object.values(ACCENT_SWATCHES)).not.toContain(typeHue(type))
    }
  })

  it('draws the three zone-5 types as the one zone-5 token', () => {
    const z5: ActivityType[] = ['VO2Max', 'Anaerobic', 'Sprint']
    for (const type of z5) expect(typeHue(type), type).toBe('var(--zone-5)')
  })
})

describe('training status colours (v4.17)', () => {
  const statuses = Object.entries(TRAINING_STATUS_COLORS)

  it('reads a status off the status tokens, never a zone, Recovery aside', () => {
    // A status is good, caution or bad news, or a neutral grey, and never a category.
    for (const [status, color] of statuses) {
      if (status === 'recovery') continue
      expect(color, status).not.toMatch(/--zone-/)
      expect(color, status).toMatch(/var\(--(pos|warn|neg|line-2|muted-foreground)\)/)
    }
  })

  it('maps the handoff pairs: Productive pos, Overreaching neg, Detraining line-2, Recovery Z1', () => {
    expect(TRAINING_STATUS_COLORS).toMatchObject({
      productive: 'var(--pos)',
      overreaching: 'var(--neg)',
      detraining: 'var(--line-2)',
      recovery: 'var(--zone-1)',
    })
  })

  it('keeps Unproductive on caution and Maintaining neutral, never good news', () => {
    expect(TRAINING_STATUS_COLORS.unproductive).toBe('var(--warn)')
    expect(TRAINING_STATUS_COLORS.maintaining).not.toMatch(/--(pos|warn|neg)/)
  })

  it('gives every status a colour of its own, so the strip and its legend tell them apart', () => {
    const colors = statuses.map(([, color]) => color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('draws fitness and fatigue as the neutral text and muted series', () => {
    // One value per theme block, light then dark.
    expect(resolved(CHART_COLORS.ctl)).toEqual(['var(--foreground)', 'var(--foreground)'])
    expect(resolved(CHART_COLORS.atl)).toEqual(['var(--muted-foreground)', 'var(--muted-foreground)'])
  })
})

describe('running-form metric hues', () => {
  // RunningFormChart draws one metric at a time, so these five never compete
  // in one frame and a derived metric can share its parent's family for free.
  it('puts each derived metric in its parent hue family', () => {
    expect(hueFamily(CHART_COLORS.verticalRatio)).toBe(hueFamily(CHART_COLORS.verticalOscillation))
    const stride = resolved(CHART_COLORS.strideLength)
    resolved(CHART_COLORS.cadence).forEach((cadence, i) => expect(hueFamily(stride[i]!)).toBe(hueFamily(cadence)))
  })

  it('spends three hue families on the five form metrics', () => {
    const families = new Set([
      CHART_COLORS.cadence,
      CHART_COLORS.groundContact,
      CHART_COLORS.verticalOscillation,
      CHART_COLORS.verticalRatio,
      CHART_COLORS.strideLength,
    ].flatMap(resolved).map(hueFamily))
    expect(families.size).toBe(3)
  })
})
