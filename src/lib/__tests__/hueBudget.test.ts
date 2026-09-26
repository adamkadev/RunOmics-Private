import { describe, expect, it } from 'vitest'
import { ACTIVITY_TYPES, type ActivityType } from '@/domain/activity/types'
import { ACTIVITY_TYPE_STYLE } from '@/components/activity/activityTypeStyle'
import { CHART_COLORS, TRAINING_PLAN_PHASE_COLORS, TRAINING_STATUS_COLORS } from '@/lib/colors'
import { ACCENT_SWATCHES, ACCENT_SWATCHES_LIGHT } from '@/lib/accent'
import { HUE, rgbTriplet } from '@/lib/palette'
import { TOKEN_BLOCKS } from '@/lib/themeTokens'

// A chart colour that is a token reads as its value in each theme.
const THEME_BLOCKS = TOKEN_BLOCKS.filter((b) => b.comment?.startsWith('Light tokens') || b.comment?.startsWith('Dark tokens'))
function resolved(value: string): string[] {
  const name = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  return name ? THEME_BLOCKS.map((b) => b.tokens[name]!) : [value]
}

/**
 * A hue family, named off the HSL hue angle. Two colours in the same family
 * are two depths of one hue; two colours in different families are a second
 * hue the app has to spend. Grey-ish colours carry no hue, so they are not
 * part of the budget.
 */
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
  it('spends at most five hue families across the seven types', () => {
    const families = new Set(TYPES.map((type) => hueFamily(typeHue(type))))
    expect([...families].sort()).toEqual(['amber', 'blue', 'green', 'orange', 'red'])
  })

  it('stays out of the families that exist only as accent themes', () => {
    // `Anaerobic` used to be violet600, which IS the endurance theme's
    // `--accent-text`, so on that theme a type dot rendered as the accent.
    // Violet and fuchsia are carried by nothing else in the app, so the ramp
    // has no business in them. Orange is not on this list: the motivation
    // accent is orange, but orange is also `Threshold`, `atl` and
    // `unproductive`, and that predates this ramp.
    const accentOnly = ['violet', 'fuchsia']
    for (const type of TYPES) expect(accentOnly, type).not.toContain(hueFamily(typeHue(type)))
    expect(Object.values(ACCENT_SWATCHES_LIGHT)).not.toContain(typeHue('Anaerobic'))
    expect(Object.values(ACCENT_SWATCHES)).not.toContain(typeHue('Anaerobic'))
  })

  it('groups the three zone-5 types into one family, deepening with effort', () => {
    // EFFORT_ZONE_BY_TYPE puts VO2Max, Anaerobic and Sprint all in Z5, so they
    // are three depths of one hue rather than three hues, and the lightest of
    // them is the `--zone-5` token itself.
    const z5: ActivityType[] = ['VO2Max', 'Anaerobic', 'Sprint']
    expect(new Set(z5.map((type) => hueFamily(typeHue(type))))).toEqual(new Set(['red']))
    expect(typeHue('VO2Max')).toBe(HUE.roRed)

    const brightness = (type: ActivityType) =>
      rgbTriplet(typeHue(type)).reduce((sum, channel) => sum + channel, 0)
    expect(brightness('VO2Max')).toBeGreaterThan(brightness('Anaerobic'))
    expect(brightness('Anaerobic')).toBeGreaterThan(brightness('Sprint'))
  })
})

describe('cross-map hue collisions', () => {
  it('does not paint a training status and a plan phase the same violet', () => {
    // WeekPurposeBanner takes its headline hue from TRAINING_STATUS_COLORS or
    // from TRAINING_PLAN_PHASE_COLORS depending on the week it is describing,
    // and PlanPhaseTrack renders the phase ramp directly below it - so one
    // violet meaning both `fresh` and `peak` was two meanings on one screen.
    expect(TRAINING_PLAN_PHASE_COLORS.peak).not.toBe(TRAINING_STATUS_COLORS.fresh)
    expect(hueFamily(TRAINING_PLAN_PHASE_COLORS.peak!)).not.toBe('violet')
  })

  it('does not paint a training status in an activity type hue', () => {
    // `maintaining` was yellow500, the Tempo hue: on the dashboard a yellow
    // ribbon segment meant "holding fitness" while a yellow dot in the rows
    // below it meant "that run was a tempo run".
    const typeHues = new Set(TYPES.map(typeHue))
    expect(typeHues.has(TRAINING_STATUS_COLORS.maintaining!)).toBe(false)
  })

  it('keeps maintaining on the good-news green rather than the caution amber', () => {
    expect(hueFamily(TRAINING_STATUS_COLORS.maintaining!))
      .toBe(hueFamily(TRAINING_STATUS_COLORS.productive!))
  })
})

describe('running-form metric hues', () => {
  // RunningFormChart draws one metric at a time, so these five never compete
  // in one frame and a derived metric can share its parent's family for free.
  it('puts each derived metric in its parent hue family', () => {
    expect(hueFamily(CHART_COLORS.verticalRatio)).toBe(hueFamily(CHART_COLORS.verticalOscillation))
    for (const cadence of resolved(CHART_COLORS.cadence)) expect(hueFamily(CHART_COLORS.strideLength)).toBe(hueFamily(cadence))
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
