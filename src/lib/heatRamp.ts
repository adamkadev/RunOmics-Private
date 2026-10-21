import { hexToOklch } from './oklch'
import { curatedAccent, type AccentId } from './accentScale'

/**
 * The heatmap's colour ramps (Wave 4, App Fixes 4d), built from the one
 * accent the reader picked. A route's frequency `t` (0 rare, 1 the busiest
 * street) picks its colour. Light runs from a pale tint through the accent
 * to a deep shade of it (4d's rgb(13,51,41) for mint); dark runs from a dim shade through the full accent
 * to a light accent, at most 25 % towards white (Wave 6). Stops are mixed
 * linearly in RGB.
 */
export type Rgb = readonly [number, number, number]
export interface RampStop {
  at: number
  rgb: Rgb
}

const WHITE: Rgb = [255, 255, 255]
/** The dark page ground the dark ramp dims towards. */
const GROUND_DARK: Rgb = [11, 12, 12]

/**
 * Under this chroma an accent has no hue worth ramping: the white accent.
 * White lines vanish on a white map, so light mode takes a graphite ramp,
 * and dark mode a fixed grey one (App Fixes 4d).
 */
const NEUTRAL_CHROMA = 0.02
const GRAPHITE_LIGHT: readonly RampStop[] = [
  { at: 0, rgb: [195, 201, 199] },
  { at: 0.4, rgb: [122, 130, 128] },
  { at: 0.75, rgb: [42, 48, 46] },
  { at: 1, rgb: [11, 12, 12] },
]
const GRAPHITE_DARK: readonly RampStop[] = [
  { at: 0, rgb: [91, 94, 93] },
  { at: 0.5, rgb: [167, 171, 169] },
  { at: 1, rgb: [233, 236, 234] },
]

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

export function rgbCss([r, g, b]: Rgb, alpha = 1): string {
  const [R, G, B] = [r, g, b].map(Math.round)
  const a = Math.round(alpha * 1000) / 1000
  return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${a})`
}

/** `a` moved a share `k` of the way to `b`. */
function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

function scale(a: Rgb, k: number): Rgb {
  return [a[0] * k, a[1] * k, a[2] * k]
}

function isNeutral(accent: string): boolean {
  return hexToOklch(accent).c < NEUTRAL_CHROMA
}

export function heatStops(mode: 'light' | 'dark', accent: string): readonly RampStop[] {
  if (isNeutral(accent)) return mode === 'light' ? GRAPHITE_LIGHT : GRAPHITE_DARK
  const A = hexToRgb(accent)
  return mode === 'light'
    ? [
        { at: 0, rgb: mix(A, WHITE, 0.45) },
        { at: 0.4, rgb: A },
        { at: 0.75, rgb: scale(A, 0.54) },
        { at: 1, rgb: scale(A, 0.25) },
      ]
    : [
        { at: 0, rgb: mix(A, GROUND_DARK, 0.65) },
        { at: 0.75, rgb: A },
        { at: 1, rgb: mix(A, WHITE, 0.25) },
      ]
}

function rampAt(stops: readonly RampStop[], t: number): Rgb {
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const lo = stops[i - 1]!
    const hi = stops[i]!
    if (x <= hi.at) return mix(lo.rgb, hi.rgb, (x - lo.at) / (hi.at - lo.at))
  }
  return stops[stops.length - 1]!.rgb
}

export function rampLight(accent: string, t: number): Rgb {
  return rampAt(heatStops('light', accent), t)
}

export function rampDark(accent: string, t: number): Rgb {
  return rampAt(heatStops('dark', accent), t)
}

/**
 * Light's halo colour by frequency (Wave 6b, 4d measured): a vivid mint
 * bloom under the dark core, never dimmed - mix(accent, white, 0.375) on a
 * rare street to scale(accent, 0.865) on the busiest, rgb(124,228,200) to
 * rgb(39,183,144) for mint. The white accent keeps a graphite halo.
 */
export function heatHaloLight(accent: string, t: number): Rgb {
  if (isNeutral(accent)) return rampLight(accent, t * 0.45)
  const A = hexToRgb(accent)
  const x = Math.min(1, Math.max(0, t))
  return mix(mix(A, WHITE, 0.375), scale(A, 0.865), x)
}

/** The legend pill's gradient: the ramp's own stops, four in light, three in dark. */
export function heatLegendGradient(mode: 'light' | 'dark', accent: string): string {
  const stops = heatStops(mode, accent).map((stop) => `${rgbCss(stop.rgb)} ${Math.round(stop.at * 100)}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** The colour a ramp is built from: the palette's full accent, in both modes. */
export function heatAccent(id: AccentId): string {
  return curatedAccent(id).dark.acc
}
