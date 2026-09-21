import { describe, expect, it } from 'vitest'
import {
  ACCENT_C,
  ACCENT_L,
  ACCENT_ROLES,
  CURATED_ACCENTS,
  HUE_STOPS,
  RESERVED_HUE_BAND,
  RESERVED_STOPS,
  SELECTABLE_STOPS,
  accentSwatchHex,
  darkRoleHex,
  isReservedHue,
  lightRoleHex,
  snapHue,
} from '@/lib/accentScale'
import { contrastRatio, hexToOklch } from '@/lib/oklch'

/** The dark surface the brief names, and the light one the app puts cards on. */
const DARK_SURFACE = '#101a2c'
const LIGHT_SURFACE = '#ffffff'

const ALL_HUES = [...HUE_STOPS, ...CURATED_ACCENTS.map((accent) => accent.hue)]

describe('the accent scale holds contrast at every hue', () => {
  // This is the whole point of fixing L and C: contrast is a property of the
  // table, so it cannot be broken by a pick. If one of these fails, ACCENT_L is
  // wrong - not the hue that failed.
  it.each(ALL_HUES)('dark-mode fill at hue %s clears 3:1 on the dark surface', (hue) => {
    expect(contrastRatio(darkRoleHex('accent', hue), DARK_SURFACE)).toBeGreaterThanOrEqual(3)
  })

  it.each(ALL_HUES)('dark-mode text at hue %s clears 4.5:1 on the dark surface', (hue) => {
    expect(contrastRatio(darkRoleHex('accentText', hue), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(ALL_HUES)('light-mode fill at hue %s clears 3:1 on white', (hue) => {
    expect(contrastRatio(lightRoleHex('accent', hue), LIGHT_SURFACE)).toBeGreaterThanOrEqual(3)
  })

  it.each(ALL_HUES)('light-mode text at hue %s clears 4.5:1 on white', (hue) => {
    expect(contrastRatio(lightRoleHex('accentText', hue), LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('holds for the neutral accent too, where chroma is nearly off', () => {
    for (const { hue, chromaScale } of CURATED_ACCENTS.filter((accent) => accent.chromaScale !== undefined)) {
      expect(contrastRatio(darkRoleHex('accent', hue, chromaScale), DARK_SURFACE)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(darkRoleHex('accentText', hue, chromaScale), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(lightRoleHex('accentText', hue, chromaScale), LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('gamut mapping keeps lightness, which is what carries the contrast', () => {
  it('never moves L to fit a hue into sRGB', () => {
    // Greens and yellows cannot hold blue's chroma at blue's lightness, so most
    // of the wheel is chroma-clamped. The clamp is only allowed to take chroma.
    for (const hue of HUE_STOPS) {
      const measured = hexToOklch(lightRoleHex('accent', hue))
      expect(Math.abs(measured.l - ACCENT_L)).toBeLessThan(0.01)
      expect(measured.c).toBeLessThanOrEqual(ACCENT_C + 0.005)
    }
  })
})

/** Every colour the app spends on meaning, and what it is for. */
const SEMANTIC_COLORS = {
  'injury red500': '#ef4444',
  'injury red400': '#f87171',
  'injury roRed': '#ff7676',
  'fatigue orange600': '#ea580c',
  'fatigue roOrange': '#f1761f',
  'fatigue roOrangeHi': '#ff9a5a',
  'caution amber500': '#f59e0b',
  'caution chip': '#f5b13d',
  'caution roAmber': '#f5b700',
  'delta-warn orange400': '#fb923c',
}

/** The floor accentContrast.test.ts already holds the accent to against --destructive. */
const MIN_DELTA_E = 30

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

describe('reserved hues', () => {
  it('covers every hue the app has already spent on meaning', () => {
    for (const [name, hex] of Object.entries(SEMANTIC_COLORS)) {
      expect(isReservedHue(hexToOklch(hex).h), name).toBe(true)
    }
  })

  it('leaves the rest of the wheel alone', () => {
    for (const hue of [120, 162.5, 195, 225, 259.8, 303.9, 345]) {
      expect(isReservedHue(hue), `hue ${hue}`).toBe(false)
    }
  })

  it('splits the 24 stops into selectable and reserved with nothing lost', () => {
    expect(RESERVED_STOPS).toEqual([0, 15, 30, 45, 60, 75, 90, 105])
    expect(SELECTABLE_STOPS).toHaveLength(HUE_STOPS.length - RESERVED_STOPS.length)
    expect([...SELECTABLE_STOPS, ...RESERVED_STOPS].sort((a, b) => a - b)).toEqual([...HUE_STOPS])
  })

  // The band is drawn in hue, but what it is defending is perceptual distance:
  // a hue just outside it can still read as the colour it was drawn to protect.
  it('leaves no selectable stop that reads as a semantic colour', () => {
    for (const stop of SELECTABLE_STOPS) {
      for (const [name, semantic] of Object.entries(SEMANTIC_COLORS)) {
        const distance = deltaE(accentSwatchHex(stop), semantic)
        expect(distance, `hue ${stop} vs ${name}`).toBeGreaterThanOrEqual(MIN_DELTA_E)
      }
    }
  })

  it('cannot be reached by snapping, from either side or from inside', () => {
    for (const hue of [...RESERVED_STOPS, RESERVED_HUE_BAND.from, RESERVED_HUE_BAND.to, 50, 89.9]) {
      expect(isReservedHue(snapHue(hue)), `snapped from ${hue}`).toBe(false)
      expect(SELECTABLE_STOPS).toContain(snapHue(hue))
    }
  })

  it('leaves the band on the far side, not back under the finger', () => {
    // A finger dragging clockwise into the band comes out at 120, not back at
    // 345 - a band that pushes back reads as a broken control, not as a gap.
    expect(snapHue(50, 345)).toBe(120)
    expect(snapHue(50, 180)).toBe(345)
    expect(snapHue(15, 345)).toBe(120)
    expect(snapHue(105, 120)).toBe(345)
  })

  it('takes the nearest stop when there is no direction to go on', () => {
    expect(snapHue(15)).toBe(345)
    expect(snapHue(85)).toBe(120)
  })
})

describe('the scale is a table, not a set of colours', () => {
  it('quantises the wheel to 24 stops of 15 degrees', () => {
    expect(HUE_STOPS).toHaveLength(24)
    expect(new Set(HUE_STOPS.map((hue, i) => hue - i * 15))).toEqual(new Set([0]))
  })

  it('anchors every role on one lightness per role and one chroma per role', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const [role, tone] of Object.entries(ACCENT_ROLES[mode])) {
        expect(tone.l, `${mode}.${role} lightness`).toBeGreaterThan(0)
        expect(tone.l, `${mode}.${role} lightness`).toBeLessThanOrEqual(1)
        expect(tone.c, `${mode}.${role} chroma`).toBeGreaterThanOrEqual(0)
      }
    }
    expect(ACCENT_ROLES.light.accent).toEqual({ l: ACCENT_L, c: ACCENT_C })
  })
})
