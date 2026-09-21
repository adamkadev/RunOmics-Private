import { oklchToHex } from './oklch'

/**
 * The accent scale: one lightness/chroma pair per token role, and a hue the
 * user may choose. Nothing about a pick can move L or C, so contrast against a
 * surface is a property of this table rather than of the choice - there is no
 * clamp to run and no pick to reject.
 *
 * Every number below is the measured OKLCH of the corresponding colour in the
 * performance (blue) theme as it shipped: blue500/#3b82f6 for the light fill,
 * blue400 for its hover, blue600 for text, blue50 for the subtle wash, and so
 * on down to performanceBgDark for the dark canvas. Blue is the reference
 * because it is the most used and most tested of the accents; the four curated
 * hues do NOT cluster tightly enough in L to average (0.62-0.72), so they are
 * normalised onto blue's.
 *
 * `npm run tokens` bakes the result into globals.css, so changing a number here
 * is a regeneration, not a runtime cost. accentScale.test.ts asserts every hue
 * stop clears 4.5:1 for text and 3:1 for fills in both modes.
 */

/** The headline pair: light-mode `--accent`, measured from blue500. */
export const ACCENT_L = 0.6231
export const ACCENT_C = 0.188

export interface Tone {
  l: number
  c: number
}

export const ACCENT_ROLES = {
  light: {
    accent: { l: ACCENT_L, c: ACCENT_C },
    accentHover: { l: 0.7137, c: 0.1434 },
    accentDark: { l: 0.5461, c: 0.2152 },
    accentSubtle: { l: 0.9705, c: 0.0142 },
    accentText: { l: 0.5461, c: 0.2152 },
    heroFrom: { l: 0.2437, c: 0.066 },
    heroVia: { l: 0.3791, c: 0.1378 },
    heroTo: { l: 0.4882, c: 0.2172 },
    aurora1: { l: 0.8091, c: 0.0956 },
    aurora2: { l: 0.9014, c: 0.0555 },
    background: { l: 0.9705, c: 0.0142 },
    canvasTop: { l: 0.9751, c: 0.0127 },
  },
  dark: {
    accent: { l: 0.7137, c: 0.1434 },
    accentHover: { l: 0.8091, c: 0.0956 },
    accentText: { l: 0.8091, c: 0.0956 },
    accentInk: { l: 0.1865, c: 0.055 },
    aurora1: { l: 0.4882, c: 0.2172 },
    aurora2: { l: 0.5876, c: 0.1389 },
    background: { l: 0.1475, c: 0.0371 },
    canvasTop: { l: 0.1652, c: 0.0411 },
  },
} as const satisfies Record<'light' | 'dark', Record<string, Tone>>

export type AccentMode = keyof typeof ACCENT_ROLES
export type LightRole = keyof typeof ACCENT_ROLES.light
export type DarkRole = keyof typeof ACCENT_ROLES.dark

/**
 * The aurora is two lights, not one: blue's second aurora (sky200, hue 230.9)
 * sits ~21 degrees counter-clockwise of its first (blue300, hue 251.8). Keeping
 * that offset is keeping one of blue's relationships - without it every theme's
 * aurora collapses to a single hue at two depths.
 */
export const AURORA_2_HUE_OFFSET = -21

/**
 * A neutral accent is the same scale with the chroma turned almost off, so
 * Silver stays one input to one code path rather than a second hand-built
 * theme. 0.19 x 0.188 lands on 0.036, which is where slate400 measured.
 */
export const NEUTRAL_CHROMA_SCALE = 0.19

export const HUE_STEP = 15
export const HUE_STOPS: readonly number[] = Array.from({ length: 360 / HUE_STEP }, (_, i) => i * HUE_STEP)

/**
 * The warm arc, which the app has already spent. Measured in OKLCH:
 *
 *   injury      roRed 22.1 · red400 22.2 · red500 25.3
 *   fatigue     orange700 38.4 · orange600 41.1 · roOrange 49.4 · roOrangeHi 51.5
 *               · delta-warn orange400 55.9
 *   caution     amber500 70.1 · chip #f5b13d 76.5 · roAmber 83.9
 *
 * The brief said 20-55. In OKLCH that stops short of amber, so caution would
 * have stayed selectable. The band also has to clear the app's own floor on
 * perceptual distance from the danger signal - accentContrast.test.ts holds the
 * accent 30 dE76 off `--destructive` - and the stop at hue 0 measured 29.3 from
 * red400, just inside it. So the band wraps 352-108: every semantic warm colour
 * plus the two stops either side that read as one of them. That leaves 16 of
 * the 24 stops, running magenta through violet, blue, cyan, teal and green to
 * lime. accentScale.test.ts asserts both halves of that: nothing semantic is
 * selectable, and every stop that is selectable stays 30 dE off everything
 * semantic.
 */
export const RESERVED_HUE_BAND = { from: 352, to: 108 } as const

export function isReservedHue(hue: number): boolean {
  const wrapped = ((hue % 360) + 360) % 360
  const { from, to } = RESERVED_HUE_BAND
  // The band crosses 0, so it is two ranges rather than one.
  return from <= to ? wrapped >= from && wrapped <= to : wrapped >= from || wrapped <= to
}

export const RESERVED_STOPS: readonly number[] = HUE_STOPS.filter(isReservedHue)
export const SELECTABLE_STOPS: readonly number[] = HUE_STOPS.filter((hue) => !isReservedHue(hue))

function circularDistance(a: number, b: number): number {
  const gap = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(gap, 360 - gap)
}

function nearestSelectable(hue: number): number {
  return SELECTABLE_STOPS.reduce((best, stop) =>
    circularDistance(stop, hue) < circularDistance(best, hue) ? stop : best,
  )
}

/** Signed shortest angle from `origin` to `hue`: positive clockwise. */
function signedDelta(origin: number, hue: number): number {
  return ((((hue - origin) % 360) + 540) % 360) - 180
}

/**
 * A raw angle, quantised to a stop the app has not already spent.
 *
 * Inside a reserved band the wheel leaves on the far side rather than by the
 * nearest edge: a finger dragging up through the band would otherwise snap
 * back under itself and the band would read as a wall rather than as a gap.
 * With no direction to go on - a tap, or a hue injected into storage - it takes
 * the nearest selectable stop.
 */
export function snapHue(hue: number, travellingFrom?: number): number {
  const wrapped = ((hue % 360) + 360) % 360
  if (!isReservedHue(wrapped)) return nearestSelectable(wrapped)
  if (travellingFrom === undefined) return nearestSelectable(wrapped)

  const step = signedDelta(travellingFrom, wrapped) >= 0 ? HUE_STEP : -HUE_STEP
  for (let i = 1; i <= HUE_STOPS.length; i++) {
    const candidate = ((Math.round(wrapped / HUE_STEP) * HUE_STEP + step * i) % 360 + 360) % 360
    if (!isReservedHue(candidate)) return candidate
  }
  return nearestSelectable(wrapped)
}

export function toneHex({ l, c }: Tone, hue: number, chromaScale = 1): string {
  return oklchToHex({ l, c: c * chromaScale, h: hue })
}

/** The colour a swatch paints: the light-mode fill, which is the scale's anchor. */
export function accentSwatchHex(hue: number, chromaScale = 1): string {
  return toneHex(ACCENT_ROLES.light.accent, hue, chromaScale)
}

export function lightRoleHex(role: LightRole, hue: number, chromaScale = 1): string {
  return toneHex(ACCENT_ROLES.light[role], hue, chromaScale)
}

export function darkRoleHex(role: DarkRole, hue: number, chromaScale = 1): string {
  return toneHex(ACCENT_ROLES.dark[role], hue, chromaScale)
}

export type AccentId = 'nature' | 'teal' | 'performance' | 'endurance' | 'silver'

/** The id a hue picked on the wheel travels under, in storage and in `data-accent`. */
export const CUSTOM_ACCENT_ID = 'custom'

export interface CuratedAccent {
  id: AccentId
  /** OKLCH hue in degrees. Curated hues are named, not snapped to the wheel's stops. */
  hue: number
  chromaScale?: number
}

/**
 * Five inputs to one code path, ordered as a hue ramp so the row reads as a
 * scale rather than a bag of colours. Nature stays first because it is the
 * theme the base `:root` block carries, so it is the one accent that needs no
 * `data-accent` attribute.
 *
 * Hues: emerald500 (162.5) keeps the app's own green rather than the brief's
 * grassier #22c55e (149.6), which would have moved the brand colour. Teal is
 * 195 rather than the brief's #14b8a6 (182.5) because 182.5 sits 20 degrees
 * off emerald and the two circles read as one colour twice; 195 is a cyan-teal
 * that cannot be mistaken for it. Blue is blue500, the scale's own reference.
 * Violet is the brief's #a855f7. Silver is slate400's hue with the chroma off.
 */
export const CURATED_ACCENTS: readonly CuratedAccent[] = [
  { id: 'nature', hue: 162.5 },
  { id: 'teal', hue: 195 },
  { id: 'performance', hue: 259.8 },
  { id: 'endurance', hue: 303.9 },
  { id: 'silver', hue: 256.8, chromaScale: NEUTRAL_CHROMA_SCALE },
]

export const ACCENT_IDS: readonly AccentId[] = CURATED_ACCENTS.map((accent) => accent.id)

export function curatedAccent(id: AccentId): CuratedAccent {
  return CURATED_ACCENTS.find((accent) => accent.id === id) ?? CURATED_ACCENTS[0]!
}
