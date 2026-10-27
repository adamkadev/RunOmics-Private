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

  // Cadence: a grey sage, clear of Pace's blue.
  cadenceDark: '#8fb3b0',
  cadenceLight: '#4f7471',

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

  /** Text grade on a light ground: the dark-mode values fail as text on white (#34d399 is 1.8:1). */
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
  // Not the "no time logged" grey, so a dominant Z1 never reads as an empty bar.
  roZone1:   '#7fb2c9',
  // Z1 a step darker for light mode: 3.2:1 on white, where #7fb2c9 is 2.3.
  roZone1Light: '#5f97b0',
  // Zone fills: never replaced by the accent.
  zone2Dark: '#7ab8ff',
  zone4Dark: '#ff9a57',
  zone5Dark: '#f0524f',
  zone4Light: '#e8590c',
  zone5Light: '#e03131',

  /** One ink ramp per theme, not one inverted: dark-mode greys read as near-white on white (#b9c4cf is 1.9:1). */
  inkLight:  '#111b28',
  inkLight2: '#3c4a59',
  inkLight3: '#5c6773',
  // 4.69:1 on white: the ramp exists to reach 4.5.
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
  // Every tier clears 4.5:1 on the darkest light ground (--background #eef3f0).
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
} as const

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
