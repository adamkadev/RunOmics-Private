export const white = '#ffffff'
export const black = '#000000'

export const HUE = {
  white,
  black,

  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate900: '#0f172a',

  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray800: '#1f2937',
  zinc400: '#a1a1aa',

  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',

  sky500: '#0ea5e9',
  sky600: '#0284c7',
  cyan300: '#67e8f9',

  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',

  green400: '#4ade80',
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',

  lime500: '#84cc16',

  yellow500: '#eab308',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  // Amber a step darker for light-mode lines: 3.5:1 on white, still amber.
  amberLine: '#b87d0f',
  amber700: '#b45309',

  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange700: '#c2410c',
  orange800: '#7c2d12',
  orange950: '#431407',

  red300: '#fca5a5',
  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',

  rose50:  '#fff1f2',
  rose300: '#fda4af',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  rose600: '#e11d48',
  rose700: '#be123c',
  rose800: '#881337',
  rose950: '#3b0716',

  pink200: '#fbcfe8',
  pink400: '#f472b6',
  pink700: '#be185d',
  pink800: '#9d174d',

  violet400: '#a78bfa',
  violet500: '#8b5cf6',
  violet600: '#7c3aed',

  roEmerald:      '#1ed787',
  roEmeraldHi:    '#4fe6a0',
  roEmeraldDeep:  '#0e9f6e',
  roEmeraldLift:  '#14b886',

  /**
   * Semantic hues at text grade on a light ground. The dark-mode values are
   * tuned for a dark card and fail as text on white - #34d399 is 1.8:1 - so the
   * light theme takes the same hue, darkened. Fills keep the dark values.
   */
  semGreenLight:  '#0f7a52',
  semOrangeLight: '#c2560f',
  semBlueLight:   '#2563eb',
  semRedLight:    '#d1453f',

  roAmber:   '#f5b700',
  roOrange:  '#f1761f',
  roOrangeHi:'#ff9a5a',
  roPink:    '#e5396b',
  roViolet:  '#8257e6',
  roBlue:    '#1276b8',
  roBlueMid: '#2f74e0',
  roBlueHi:  '#7db8ff',
  roRed:     '#ff7676',
  roRust:    '#a1662f',
  roSage:    '#a7b1aa',
  // Zone 1 (warmup) used to share the grey the app reserves for "no time
  // logged", so a dominant Z1 read as an empty bar. A desaturated step below
  // Z2's blue keeps the Z1→Z5 ramp reading as rising intensity in both themes.
  roZone1:   '#7fb2c9',
  // Z1 a step darker for light mode: 3.2:1 on white, where #7fb2c9 is 2.3.
  roZone1Light: '#5f97b0',

  /**
   * The ink ramp, one per theme rather than one inverted. Dark-mode greys read
   * as near-white on white: #b9c4cf on #ffffff is 1.9:1, so a caption drawn in
   * it was invisible in light mode. Each step is its own colour, matched in hue
   * and re-darkened for the ground it sits on.
   */
  inkLight:  '#111b28',
  inkLight2: '#3c4a59',
  inkLight3: '#5c6773',
  // Spec said #76828f, which measures 3.92:1 on white - under the 4.5 this
  // ramp exists to reach. Same hue, one step down: 4.69:1.
  inkLight4: '#6a7581',
  inkDark:   '#e9eff7',
  inkDark2:  '#b9c4cf',
  inkDark3:  '#8d99a6',
  inkDark4:  '#7d8896',

  roInk:      '#0b1f17',
  roInk2:     '#48564e',
  roInk3:     '#7c8a82',
  roInkInv:   '#eef2f0',
  roInkInv2:  '#a8b4ae',
  roInkInv3:  '#8a978f',
  roInkInv4:  '#6f7f79',
  // The light muted scale. Every tier clears 4.5:1 on the darkest light ground
  // (--background #eef3f0); the old slate400/slate500/#b0bec5 set sat at
  // 2.28, 4.24 and 1.70 respectively.
  roMuted:    '#3a4757',
  roSubtle:   '#4e5a6b',
  roSubtle2:  '#606e82',

  natureBgDark:      '#060a08',
  natureCardDark:    '#0d110f',
  natureShadow:      '#08281c',

  performanceBgDark:    '#06091a',

  heroBase:      '#0a0f0c',
  mapMarkerRing: '#0b1220',
  sheetInk:      '#0e1612',
  iosFill:       '#787880',

  shareAuroraDark:   '#050d0a',
  shareAuroraLight:  '#f0fdf8',
  sharePulseDark:    '#040810',
  sharePulseLight:   '#f8fafe',
  shareTerrainDark:  '#040a06',
  shareTerrainLight: '#f2faf4',
  sharePrismDark:    '#060408',
  sharePrismLight:   '#fafaf9',
  shareMapDark:      '#09101a',
  shareMapLight:     '#edf1f7',

  shareMemoryDark1:  '#1c0c06',
  shareMemoryDark2:  '#2e1610',
  shareMemoryDark3:  '#12160a',
  shareMemoryDark4:  '#060a05',
  shareMemoryLight1: '#ffe4cc',
  shareMemoryLight2: '#ffcba4',
  shareMemoryLight3: '#a8c88a',
  shareMemoryLight4: '#5c7a48',
  shareMemoryHorizon: '#121c0a',
} as const

export type Hue = keyof typeof HUE

export function rgbTriplet(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgbTriplet(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export const paper = (a: number): string => withAlpha(white, a)

export const ink = (a: number): string => withAlpha(black, a)
