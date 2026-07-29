// THE single source of every raw color literal in RunOmics.
//
// Nothing else in the codebase may contain a hex literal. The CSS custom
// properties in globals.css are *generated* from `src/lib/themeTokens.ts`
// (which builds on this file) - run `npm run tokens` after any change here.
// Every TS consumer that needs a real color string (Recharts, MapLibre, the
// share-card canvas, the splash generator) imports from here too.
//
// Keys follow Tailwind's palette names where the value is a Tailwind value,
// so `blue500` reads the same as the `blue-500` the old inline comments used.
// Values that are ours rather than Tailwind's live under the `RO` groups.
//
// This module must stay dependency-free and alias-free: `scripts/generate-tokens.mjs`
// imports it directly with Node's type stripping, which cannot resolve `@/`.

// ── Neutrals ────────────────────────────────────────────────────────────────
export const white = '#ffffff'
export const black = '#000000'

// ── Tailwind ramps (only the steps actually used) ───────────────────────────
export const HUE = {
  white,
  black,

  slate50:  '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray800: '#1f2937',
  zinc400: '#a1a1aa',

  blue50:  '#eff6ff',
  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue900: '#1e3a8a',

  sky200: '#bae6fd',
  sky500: '#0ea5e9',
  sky600: '#0284c7',
  cyan300: '#67e8f9',

  emerald50:  '#ecfdf5',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',

  green400: '#4ade80',
  green500: '#22c55e',
  green700: '#15803d',
  green800: '#166534',
  green900: '#14532d',

  teal500: '#14b8a6',
  lime500: '#84cc16',

  yellow500: '#eab308',
  amber200: '#fde68a',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber700: '#b45309',

  orange50:  '#fff7ed',
  orange300: '#fdba74',
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

  fuchsia500: '#d946ef',

  violet50:  '#f5f3ff',
  violet300: '#c4b5fd',
  violet400: '#a78bfa',
  violet500: '#8b5cf6',
  violet600: '#7c3aed',
  violet700: '#6d28d9',
  violet900: '#4c1d95',

  purple200: '#e9d5ff',
  purple700: '#7e22ce',

  // ── RunOmics brand hues (not Tailwind) ────────────────────────────────────
  /** The dark-mode accent and the app's signature green. */
  roEmerald:      '#1ed787',
  roEmeraldHi:    '#4fe6a0',
  /** The light-mode accent - same green, darkened for pale surfaces. */
  roEmeraldDeep:  '#0e9f6e',
  roEmeraldLift:  '#14b886',
  roEmeraldShade: '#0b8a5f',
  roEmeraldShadeDark: '#0b9c63',
  /** Text/icon color that sits on top of the emerald accent in dark mode. */
  roEmeraldInk:   '#052015',

  // Ink that sits on top of each *dark* accent fill. One per hue: a shared ink
  // would tint every primary button toward whichever hue it was cut from (the
  // emerald ink used to green out the blue/rose/orange/violet/silver themes).
  performanceInk: '#04122b',
  impactInk:      '#2b040c',
  motivationInk:  '#2b1203',
  enduranceInk:   '#170b2e',
  silverInk:      '#0b1220',

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

  // ── RunOmics ink (foreground ramp) ────────────────────────────────────────
  roInk:      '#0b1f17',
  roInk2:     '#48564e',
  roInk3:     '#7c8a82',
  roInkInv:   '#eef2f0',
  roInkInv2:  '#a8b4ae',
  roInkInv3:  '#8a978f',
  roInkInv4:  '#6b7a74',
  roSteel:    '#b0bec5',

  // ── Surfaces, per accent theme ────────────────────────────────────────────
  natureBg:          '#eef3f0',
  natureCanvasTop:   '#f5f9f7',
  natureBgDark:      '#060a08',
  natureCanvasDark:  '#07100c',
  natureCardDark:    '#0d110f',
  /** iOS theme-color for the dark nature theme - slightly lifted off natureBgDark. */
  natureStatusDark:  '#070f0c',
  natureHeroDeep:    '#0d2e1a',
  natureAurora1:     '#a7f3d6',
  natureAurora2:     '#bcd6ff',
  /** Shadow tint for the light glass surfaces - a desaturated forest green. */
  natureShadow:      '#08281c',

  performanceCanvasTop: '#f0f8ff',
  performanceBgDark:    '#06091a',
  performanceCanvasDark:'#070d20',
  performanceHeroDeep:  '#0c1f3f',

  impactCanvasTop:  '#fff5f6',
  impactBgDark:     '#130608',
  impactCanvasDark: '#190a0d',
  // Light hero stops mixed toward ink: the raw rose ramp read as a saturated
  // "destructive/error" wash rather than branding (F14).
  impactHeroFrom:   '#2b0712',
  impactHeroVia:    '#6f1030',
  impactHeroTo:     '#9f1239',

  motivationCanvasTop:  '#fffaf3',
  motivationBgDark:     '#130a04',
  motivationCanvasDark: '#1a1007',
  // Same softening as impact: burnt-orange toward ink instead of an alert orange.
  motivationHeroFrom:   '#33110a',
  motivationHeroVia:    '#5f2510',
  motivationHeroTo:     '#983811',

  enduranceCanvasTop:  '#faf8ff',
  enduranceBgDark:     '#0d0a1a',
  enduranceCanvasDark: '#120f21',
  enduranceHeroDeep:   '#1e1038',

  silverCanvasTop:  '#fafbfc',
  silverBgDark:     '#080c10',
  silverCanvasDark: '#0d1117',

  // ── One-off surfaces ──────────────────────────────────────────────────────
  /** TodayHero's near-black base, kept off natureCardDark so the hero reads deeper. */
  heroBase:      '#0a0f0c',
  /** Ink on the amber "caution" chip in the activity map legend. */
  mapChipInk:    '#1a1400',
  /** Marker outline on dark map tiles. */
  mapMarkerRing: '#0b1220',
  /** Base of the always-dark workout sheet, tinted toward the forest green. */
  sheetInk:      '#0e1612',
  /** iOS system fill, used for the share-card toggle track in its off state. */
  iosFill:       '#787880',

  // ── Share-card canvas backdrops (paired light / dark per design) ──────────
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

  // Golden-hour placeholder gradient for the `memory` design.
  shareMemoryDark1:  '#1c0c06',
  shareMemoryDark2:  '#2e1610',
  shareMemoryDark3:  '#12160a',
  shareMemoryDark4:  '#060a05',
  shareMemoryLight1: '#ffe4cc',
  shareMemoryLight2: '#ffcba4',
  shareMemoryLight3: '#a8c88a',
  shareMemoryLight4: '#5c7a48',
  /** Tree-line silhouette over the light golden-hour placeholder. */
  shareMemoryHorizon: '#121c0a',
} as const

export type Hue = keyof typeof HUE

// ── Helpers ─────────────────────────────────────────────────────────────────

/** `'#3b82f6'` -> `[59, 130, 246]`. Accepts 3- and 6-digit hex. */
export function rgbTriplet(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** `withAlpha('#3b82f6', 0.35)` -> `'rgba(59, 130, 246, 0.35)'`. */
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgbTriplet(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Translucent white - the highlight/track ink on dark surfaces. */
export const paper = (a: number): string => withAlpha(white, a)

/** Translucent black - the scrim/shadow ink on light surfaces. */
export const ink = (a: number): string => withAlpha(black, a)
