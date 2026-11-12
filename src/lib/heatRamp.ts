import { curatedAccent, type AccentId } from './accentScale'

export type Rgb = readonly [number, number, number]
export interface RampStop {
  at: number
  rgb: Rgb
}

const WHITE: Rgb = [255, 255, 255]
/** The dark page ground. */
const GROUND_DARK: Rgb = [11, 12, 12]

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

export function heatStops(mode: 'light' | 'dark', accent: string): readonly RampStop[] {
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
