/**
 * Björn Ottosson's matrices (https://bottosson.github.io/posts/oklab/). Gamut
 * mapping reduces chroma and leaves L alone, so a generated colour is never
 * lighter or darker than its token role says.
 */

export interface Oklch {
  /** Perceptual lightness, 0-1. */
  l: number
  /** Chroma, 0 to ~0.37 in sRGB. */
  c: number
  /** Hue angle in degrees, 0-360. */
  h: number
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

function parseHex(hex: string): [number, number, number] {
  const body = hex.replace('#', '')
  const full = body.length === 3 ? [...body].map((ch) => ch + ch).join('') : body
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function toHex(channel: number): string {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0')
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(srgbToLinear) as [number, number, number]

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const c = Math.hypot(a, bb)
  const h = c < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  return { l, c, h }
}

function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

function inGamut(linear: [number, number, number]): boolean {
  return linear.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4)
}

/** Twenty bisections land within ~1e-7 of the sRGB boundary, far below an 8-bit step. */
export function clampChromaToGamut(l: number, c: number, h: number): number {
  if (inGamut(oklchToLinearSrgb({ l, c, h }))) return c
  let low = 0
  let high = c
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    if (inGamut(oklchToLinearSrgb({ l, c: mid, h }))) low = mid
    else high = mid
  }
  return low
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const linear = oklchToLinearSrgb({ l, c: clampChromaToGamut(l, c, h), h })
  return `#${linear.map((channel) => toHex(linearToSrgb(channel))).join('')}`
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(srgbToLinear) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.1 contrast ratio, 1-21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}
