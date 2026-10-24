import { HUE, ink, paper } from './palette'
import { CURATED_ACCENTS, curatedAccent, type CuratedAccent } from './accentScale'
import { contrastRatio, hexToOklch, oklchToHex } from './oklch'

export type TokenBlock = {
  selector: string
  comment?: string
  tokens: Record<string, string>
}

const c = HUE

/**
 * A category scale, never a status (that is --pos, --warn and --neg). The
 * share card paints on a canvas and cannot read a token, so it reads this
 * table. Light keeps deeper steps: a zone mark needs 3:1 on a white card.
 */
export const ZONE_HEX = {
  light: ['#61788f', '#2f74e0', '#6a52d9', '#ae3cc2', '#d63a77'],
  dark: ['#8a9bb0', '#5b9cf5', '#8f7cf0', '#c77ae6', '#f07aa8'],
} as const

/**
 * Status only, never a category: a delta takes one by what it means, not by
 * which way it moved (fatigue +6 is warn, fitness +4 is pos). Good is mint, to
 * match the default accent rather than add a third green. Light neg clears
 * 4.5:1 on its own 12 % tint (a missed day's "✕ 10 km"); dark neg is a soft
 * coral so an error does not read as Z5.
 */
export const STATUS_HEX = {
  light: { pos: c.semGreenLight, warn: '#9a5b00', neg: '#c0352a' },
  dark: { pos: '#2dd4a7', warn: '#f0b73c', neg: '#ff8a80' },
} as const

/**
 * The same under every accent: colour is for data and the active state, never
 * for a background, a card, a border or a shadow.
 */
export const SURFACES = {
  light: {
    background: '#f3f4f3',
    card: '#ffffff',
    raised: '#ffffff',
    line: '#e4e6e5',
    divider: '#e4e6e5',
    // Outline buttons and neutral bars.
    line2: '#d3d6d4',
    text: '#141615',
    body: '#434846',
    // Labels and meta.
    text2: '#6b706e',
    // The map's street labels. Not for UI text: see subtle.
    text3: '#9aa09d',
    // Faint UI text at 4.5:1: on the light ground nothing lighter than text2 reaches it.
    subtle: '#6b706e',
    tabBar: '#ffffff',
    // Tracks, inset tiles, the segmented control's ground.
    seg: '#f0f1f0',
    pill: '#ffffff',
    faint: '#f0f1f0',
    // Reference series and neutral bars: 3:1 or more on a card.
    band: '#8e9491',
    restBar: '#d9dcdb',
    neutralBar: '#b4b9b7',
    axisText: '#8d9391',
    amber: STATUS_HEX.light.warn,
    shadowRaised: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  dark: {
    background: '#0b0c0c',
    card: '#141616',
    raised: '#1a1d1d',
    line: '#232626',
    divider: '#1f2222',
    line2: '#303432',
    text: '#f2f4f3',
    body: '#a3aaa7',
    text2: '#8d9391',
    text3: '#5b6563',
    // A step under text2 that still reaches 4.5:1.
    subtle: '#7f8482',
    tabBar: '#0d0f0f',
    seg: '#0f1111',
    // The active segment.
    pill: '#2a2e2d',
    // Empty tracks: gauges, progress bars, rest days.
    faint: '#262a29',
    band: '#6a706d',
    restBar: '#3a3f3e',
    neutralBar: '#5b6260',
    axisText: '#6b7270',
    amber: STATUS_HEX.dark.warn,
    shadowRaised: 'none',
  },
} as const

/**
 * The page's own background, so the band iOS paints from the theme-color meta
 * reads as the page under the notch. iOS stores it at install and only picks
 * light or dark at launch, so it cannot follow the accent.
 */
export const STATUS_BAR_COLOR = { light: SURFACES.light.background, dark: SURFACES.dark.background } as const

function surfaceTokens(mode: 'light' | 'dark'): Record<string, string> {
  const n = SURFACES[mode]
  const status = STATUS_HEX[mode]
  return {
    '--background': n.background,
    '--canvas': n.background,
    '--card': n.card,
    '--raised': n.raised,
    '--popover': n.raised,
    '--muted': n.seg,
    '--surface-2': n.seg,
    '--border': n.line,
    '--divider': n.divider,
    '--line-2': n.line2,
    '--foreground': n.text,
    '--text-2': n.body,
    '--muted-foreground': n.text2,
    '--subtle': n.subtle,
    '--subtle-2': n.subtle,
    '--ro-text': n.text,
    '--ro-text-2': n.text2,
    '--ro-text-3': n.subtle,
    '--track': n.faint,
    '--heat-empty': n.faint,
    '--band': n.band,
    '--rest-bar': n.restBar,
    '--neutral-bar': n.neutralBar,
    '--axis-text': n.axisText,
    '--thumb-bg': n.seg,
    '--tab-bar-bg': n.tabBar,
    '--tab-bar-hairline': n.divider,
    '--pos': status.pos,
    '--warn': status.warn,
    '--neg': status.neg,
    // Caution and race only.
    '--tone-caution': status.warn,
    '--shadow-card': 'none',
    '--shadow-raised': n.shadowRaised,
    '--shadow-hero': 'none',
    '--hero-gradient': n.card,
    '--hero-glow': 'transparent',
    '--glass-sat': '1',
    '--glass-bg': n.card,
    '--glass-border': n.line,
    '--glass-highlight': 'transparent',
    '--glass-shadow-float': 'none',
    '--glass-shadow-nav': 'none',
    '--glass-fallback': n.card,
    '--glass-row-bg': n.card,
    '--glass-bg-sheet': n.card,
    '--glass-bg-nav': n.tabBar,
  }
}

/**
 * Baked into src/map/styles by scripts/build-map-styles.ts. Only parks and
 * water take a muted hue, so the accent route stays the one bright colour.
 */
export const MAP_STYLE_COLORS = {
  dark: {
    background: '#111212',
    land: '#141615',
    park: '#15261d',
    water: '#13212e',
    waterway: '#13212e',
    building: '#171918',
    roadMajor: '#252b2a',
    roadMinor: '#1b201f',
    roadCasing: '#171918',
    path: '#232625',
    rail: SURFACES.dark.line,
    border: SURFACES.dark.line2,
    placeLabel: SURFACES.dark.text2,
    streetLabel: '#4f5856',
    halo: SURFACES.dark.background,
    hillshadeShadow: 'rgba(0, 0, 0, 0.07)',
    hillshadeHighlight: 'rgba(255, 255, 255, 0.03)',
  },
  light: {
    background: '#eef0ef',
    // A whisper more contrast under clear glass: the rim still reads as an edge over a white road.
    land: '#e3e8e5',
    park: '#d3e6d0',
    water: '#c6dbee',
    waterway: '#c6dbee',
    building: SURFACES.light.line,
    roadMajor: '#fbfcfb',
    roadMinor: '#f8f9f8',
    roadCasing: SURFACES.light.line,
    path: '#ffffff',
    rail: SURFACES.light.line2,
    border: SURFACES.light.line2,
    placeLabel: SURFACES.light.text2,
    streetLabel: '#9aa19f',
    halo: SURFACES.light.background,
    hillshadeShadow: 'rgba(0, 0, 0, 0.06)',
    hillshadeHighlight: 'rgba(255, 255, 255, 0.07)',
  },
} as const

export type MapStyleColors = { [K in keyof (typeof MAP_STYLE_COLORS)['dark']]: string }

/** Text's AA floor: small accent labels must clear it. */
const TEXT_CONTRAST = 4.5

export function readableOn(hex: string, ground: string, ratio = TEXT_CONTRAST): string {
  const colour = hexToOklch(hex)
  let text = hex
  for (let l = colour.l; contrastRatio(text, ground) < ratio && l > 0; l -= 0.005) text = oklchToHex({ ...colour, l })
  return text
}

/**
 * The darkest ground a label on light glass sits on: a medium sheet's 55 %
 * glass over the 20 % scrim on the page, under a control's 12 % fill.
 */
const GLASS_LABEL_GROUND = '#d4d5d5'

/**
 * In light mode an accent reads under 4.5:1 on the page ground and inset
 * tiles, so its text is darkened; fills and rings keep the accent.
 */
export function accentTokens(accent: Pick<CuratedAccent, 'dark' | 'light'>, mode: 'light' | 'dark'): Record<string, string> {
  const { acc, onAcc } = accent[mode]
  return {
    '--accent': acc,
    '--accent-foreground': onAcc,
    '--accent-text': mode === 'light' ? readableOn(acc, SURFACES.light.seg) : acc,
    '--accent-text-glass': mode === 'light' ? readableOn(acc, GLASS_LABEL_GROUND) : acc,
    '--accent-hover': `color-mix(in oklab, ${acc} 88%, ${mode === 'dark' ? 'white' : 'black'})`,
    '--accent-soft': `${acc}1f`,
    '--acc-soft': `${acc}1f`,
    '--acc-line': `color-mix(in oklab, ${acc} 55%, transparent)`,
    '--ring': `color-mix(in oklab, ${acc} ${mode === 'dark' ? 70 : 35}%, transparent)`,
  }
}

/**
 * Only the navigation chrome is glass; content stays opaque. Tuned against
 * SURFACES, and consumed by the `.lg` recipe in globals.css.
 */
const DARK_GLASS_FILTER = 'blur(12px) saturate(1.9) brightness(1.1)'

export function glassTokens(mode: 'light' | 'dark'): Record<string, string> {
  return mode === 'light'
    ? {
        // Any more white and the glass reads as an opaque pill on the near-white page.
        '--glass-filter': 'blur(18px) saturate(2.1) brightness(1.02)',
        '--glass-fill': 'rgb(255 255 255 / 0.22)',
        '--glass-sheen': 'rgb(255 255 255 / 0.45)',
        '--glass-rim': 'linear-gradient(135deg, rgb(255 255 255 / 0.98) 0%, rgb(255 255 255 / 0.5) 28%, rgb(255 255 255 / 0.2) 50%, rgb(255 255 255 / 0.5) 72%, rgb(255 255 255 / 0.9) 100%)',
        '--glass-rim-pressed': 'linear-gradient(135deg, #ffffff 0%, rgb(255 255 255 / 0.6) 28%, rgb(255 255 255 / 0.3) 50%, rgb(255 255 255 / 0.6) 72%, #ffffff 100%)',
        '--glass-inner': 'none',
        '--glass-drop': '0 0 0 0.5px rgb(0 0 0 / 0.14), 0 10px 28px rgb(30 40 60 / 0.16), 0 2px 4px rgb(0 0 0 / 0.08)',
        '--glass-edge-w': '3px',
        '--glass-edge-filter': 'blur(1px) saturate(2) brightness(1.08)',
        '--tab-glass-fill': 'rgb(255 255 255 / 0.36)',
        '--clear-glass-fill': 'rgb(255 255 255 / 0.10)',
        '--clear-glass-filter': 'blur(8px) saturate(1.8)',
        '--sheet-glass-fill': 'rgb(250 251 250 / 0.55)',
        // Wider: a sheet sits over text that must not read through.
        '--sheet-glass-filter': 'blur(28px) saturate(2)',
        '--sheet-fill': 'rgb(0 0 0 / 0.05)',
        '--sheet-fill-rim': 'none',
        '--sheet-pill': '#ffffff',
        '--sheet-pill-shadow': '0 2px 6px rgb(0 0 0 / 0.08)',
        '--radio-ring': 'rgb(0 0 0 / 0.22)',
        // The page's grey falls under 4.5:1 on a sheet over the scrim.
        '--glass-text2': readableOn(SURFACES.light.text2, GLASS_LABEL_GROUND),
        '--shadow-sheet': '0 24px 60px rgb(0 0 0 / 0.18)',
        '--tab-pill': 'rgb(0 0 0 / 0.07)',
        // System-style fills for controls on the content layer
        '--fill-3': 'rgb(118 118 128 / 0.12)',
        '--fill-4': 'rgb(118 118 128 / 0.08)',
        '--segmented-track': 'var(--fill-3)',
        '--segmented-pill': '#ffffff',
        '--segmented-pill-shadow': '0 3px 8px rgb(0 0 0 / 0.12), 0 1px 1px rgb(0 0 0 / 0.04)',
        '--card-edge': '0 1px 2px rgb(0 0 0 / 0.04), 0 0 0 0.5px rgb(0 0 0 / 0.04)',
        '--row-separator': 'rgb(0 0 0 / 0.08)',
        // A tint of the page's ink, not a grey wash.
        '--scrim-sheet': 'rgb(20 24 22 / 0.16)',
      }
    : {
        '--glass-filter': DARK_GLASS_FILTER,
        '--glass-fill': 'rgb(42 46 45 / 0.46)',
        '--glass-sheen': 'rgb(255 255 255 / 0.09)',
        '--glass-rim': 'linear-gradient(135deg, rgb(255 255 255 / 0.42) 0%, rgb(255 255 255 / 0.1) 26%, rgb(255 255 255 / 0) 50%, rgb(255 255 255 / 0.06) 74%, rgb(255 255 255 / 0.24) 100%)',
        '--glass-rim-pressed': 'linear-gradient(135deg, rgb(255 255 255 / 0.6) 0%, rgb(255 255 255 / 0.14) 26%, rgb(255 255 255 / 0) 50%, rgb(255 255 255 / 0.1) 74%, rgb(255 255 255 / 0.34) 100%)',
        '--glass-inner': 'inset 0 0 8px rgb(255 255 255 / 0.05)',
        '--glass-drop': '0 10px 30px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.30)',
        '--glass-edge-w': '3px',
        '--glass-edge-filter': 'blur(1px) saturate(2.2) brightness(1.25)',
        '--tab-glass-fill': 'rgb(34 38 37 / 0.60)',
        '--clear-glass-fill': 'rgb(16 18 18 / 0.22)',
        '--clear-glass-filter': 'blur(5px) saturate(1.6) brightness(0.9)',
        '--sheet-glass-fill': 'rgb(28 31 31 / 0.80)',
        '--sheet-glass-filter': 'blur(28px) saturate(1.8)',
        '--sheet-fill': 'rgb(255 255 255 / 0.10)',
        '--sheet-fill-rim': 'inset 0 0.5px 0 rgb(255 255 255 / 0.25)',
        '--sheet-pill': 'rgb(255 255 255 / 0.18)',
        '--sheet-pill-shadow': 'inset 0 0.5px 0 rgb(255 255 255 / 0.3)',
        '--radio-ring': 'rgb(255 255 255 / 0.35)',
        '--shadow-sheet': '0 24px 60px rgb(0 0 0 / 0.35)',
        '--tab-pill': 'rgb(255 255 255 / 0.11)',
        '--fill-3': 'rgb(118 118 128 / 0.24)',
        '--fill-4': 'rgb(118 118 128 / 0.18)',
        '--segmented-track': 'var(--fill-3)',
        '--segmented-pill': '#4b504f',
        '--segmented-pill-shadow': '0 2px 6px rgb(0 0 0 / 0.35)',
        '--card-edge': 'inset 0 0 0 0.5px rgb(255 255 255 / 0.07)',
        '--row-separator': 'rgb(255 255 255 / 0.08)',
        '--scrim-sheet': 'rgb(0 0 0 / 0.45)',
      }
}

/**
 * Concentric with the 55 pt display corner (inner radius = outer radius -
 * inset): a 62 pt capsule 24 pt from the edge, a sheet 8 pt in with a 47 pt corner.
 */
export const GEOMETRY_TOKENS: Record<string, string> = {
  '--tab-bar-h': '62px',
  '--tab-bar-side': '24px',
  // 24 pt on Face ID iPhones (safe-bottom 34), 12 pt where there is no inset.
  '--tab-bar-float': 'max(calc(var(--safe-bottom) - 10px), 12px)',
  '--edge-fade': '30px',
  // Light's top edge: solid to the bar's foot, then this fade, blurred in it only.
  '--edge-band': '24px',
  '--radius-card': '24px',
  '--radius-tile': '12px',
  // Medium detent at 8 pt inset.
  '--radius-sheet': '47px',
  // Large detent, top corners only.
  '--radius-sheet-large': '38px',
  '--sheet-inset': '8px',
  // 47 - 22 = 25: a 50 pt capsule CTA is concentric with the sheet.
  '--sheet-pad': '22px',
}

function semanticTokens(mode: 'light' | 'dark'): Record<string, string> {
  return {
    '--delta-good': 'var(--pos)',
    '--delta-warn': 'var(--warn)',
    '--good': 'var(--pos)',
    '--destructive': 'var(--neg)',
    // Form is drawn by its bands; fitness is the solid line, fatigue the dashed one.
    '--metric-fitness': 'var(--foreground)',
    '--metric-fatigue': 'var(--muted-foreground)',
    '--tone-go': 'var(--pos)',
    '--tone-hold': 'var(--warn)',
    // Garmin's "peaking", the app's `fresh`.
    '--status-peaking': 'var(--pos)',
    '--form-band-tired': 'var(--warn)',
    '--form-band-neutral': 'var(--muted-foreground)',
    '--form-band-fresh': 'var(--pos)',
    '--form-band-very-fresh': 'var(--warn)',
    '--form-band-fill-fresh': 'var(--pos)',
    '--form-band-fill-neutral': 'var(--band)',
    '--form-band-fill-tired': 'var(--warn)',
    '--series-2': 'var(--band)',
    '--series-3': 'var(--muted-foreground)',
    // Accent shares, not colours, so the ramp follows the accent; light sets
    // its steps wider apart to stay distinct on the pale ground.
    '--level-rest': mode === 'dark' ? '#262928' : '#eceeed',
    '--level-low': mode === 'dark' ? '35%' : '40%',
    '--level-mid': mode === 'dark' ? '65%' : '70%',
    // White on the deep light zones (4.4-8.7:1), ink on the bright dark ones (5.6-9.3:1).
    '--zone-ink': mode === 'dark' ? c.roInk : '#ffffff',
    '--zone-1': ZONE_HEX[mode][0],
    '--zone-2': ZONE_HEX[mode][1],
    '--zone-3': ZONE_HEX[mode][2],
    '--zone-4': ZONE_HEX[mode][3],
    '--zone-5': ZONE_HEX[mode][4],
    '--chart-cadence': mode === 'dark' ? c.cadenceDark : c.cadenceLight,
    '--chart-easy': 'var(--zone-2)',
    '--chart-hard': 'var(--zone-4)',
    '--chart-ground-contact': mode === 'dark' ? c.amber500 : c.amberLine,
    '--chart-brand': 'var(--accent)',
    // The busiest street's colour: in dark, the near-white the additive heat map burns to.
    '--heat-end': mode === 'dark' ? 'color-mix(in srgb, var(--accent) 35%, #ffffff)' : 'color-mix(in srgb, var(--accent) 45%, #000000)',
    '--ro-accent': 'var(--accent)',
    '--ro-accent-hi': 'var(--accent-hover)',
    '--ro-ink': c.roInk,
    '--ro-blur': '18px',
  }
}

const DEFAULT = curatedAccent('teal')

function accentBlocks(accent: CuratedAccent): TokenBlock[] {
  return [
    { selector: `[data-accent="${accent.id}"]`, tokens: accentTokens(accent, 'light') },
    { selector: `.dark[data-accent="${accent.id}"]`, tokens: accentTokens(accent, 'dark') },
  ]
}

export const TOKEN_BLOCKS: TokenBlock[] = [
  {
    selector: ':root',
    comment: 'Theme-independent tokens',
    tokens: {
      '--blur-sm': '8px',
      '--blur-md': '18px',
      '--blur-lg': '28px',
      '--saturate': '1.6',
      '--color-missed': 'var(--neg)',
      '--safe-top': 'env(safe-area-inset-top, 0px)',
      // The status bar is opaque (statusBarStyle 'default'), so the top inset is 0 in the installed app.
      '--top-scrim': 'calc(var(--safe-top) + 12px)',
      // Over 10 px tall, so WebKit's scroll-edge check finds a bar and iOS 26
      // draws no blur of its own over the page top.
      '--edge-sample-h': '12px',
      // The sampler's 12 px, a 46 px row, then 10 px to the hairline.
      '--bar-h': '68px',
      '--bar-fade': '18px',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--tap-min': '44px',
      '--state-ring': '2px',
      '--scrim': ink(0.25),
      '--scrim-strong': ink(0.6),
      '--track-on-dark': paper(0.08),
      '--track-on-dark-strong': paper(0.18),
      '--shadow-toggle': `0 2px 6px ${ink(0.28)}`,
      '--shadow-modal': `0 8px 32px ${ink(0.55)}, 0 2px 8px ${ink(0.35)}`,
      '--shadow-thumb': `0 4px 12px ${ink(0.45)}`,
      '--map-attrib-bg': ink(0.5),
      '--map-attrib-fg': paper(0.75),
      ...GEOMETRY_TOKENS,
    },
  },
  {
    selector: ':root',
    comment: 'Light tokens - Teal (default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.light,
      ...semanticTokens('light'),
      ...glassTokens('light'),
      ...accentTokens(DEFAULT, 'light'),
      ...surfaceTokens('light'),
    },
  },
  {
    selector: '.dark',
    comment: 'Dark tokens - Teal (default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.dark,
      ...semanticTokens('dark'),
      ...glassTokens('dark'),
      ...accentTokens(DEFAULT, 'dark'),
      ...surfaceTokens('dark'),
    },
  },
  ...CURATED_ACCENTS.filter((accent) => accent.id !== DEFAULT.id).flatMap(accentBlocks),
]
