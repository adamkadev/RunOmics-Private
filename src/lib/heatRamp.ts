import { hexToOklch } from './oklch'
import { curatedAccent, type AccentId } from './accentScale'

export type Rgb = readonly [number, number, number]
export interface RampStop {
  at: number
  rgb: Rgb
}

const WHITE: Rgb = [255, 255, 255]
/** The dark page ground. */
const GROUND_DARK: Rgb = [11, 12, 12]

/** Under this chroma (the white accent) there is no hue to ramp, and white lines vanish on a white map. */
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

export function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

export function scale(a: Rgb, k: number): Rgb {
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

/** `t` is a route's frequency: 0 rare, 1 the busiest street. */
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

export function heatLegendGradient(mode: 'light' | 'dark', accent: string): string {
  const stops = heatStops(mode, accent).map((stop) => `${rgbCss(stop.rgb)} ${Math.round(stop.at * 100)}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** The full accent, in both modes. */
export function heatAccent(id: AccentId): string {
  return curatedAccent(id).dark.acc
}
