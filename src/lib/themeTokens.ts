import { HUE, ink, paper } from './palette'
import { CURATED_ACCENTS, curatedAccent, type CuratedAccent } from './accentScale'
import { contrastRatio, hexToOklch, oklchToHex } from './oklch'

/**
 * The opaque status bar's colour in an installed iPhone app, one per mode.
 * iOS stores it from the theme-color meta at install and only picks light or
 * dark at launch, so it can't follow the accent: it is a neutral close to
 * every accent's background, and the page top fades from it (--status-bar).
 */
export const STATUS_BAR_COLOR = { light: '#f3f4f3', dark: '#0b0c0c' } as const

export type TokenBlock = {
  selector: string
  comment?: string
  tokens: Record<string, string>
}

const c = HUE

/**
 * Z1 to Z5 per mode, the values behind `--zone-1..5` (v4.17): one intensity
 * scale - recovery slate, easy blue, aerobic violet, threshold magenta, max
 * rose - that also colours every session type (lib/colors TYPE_ZONE). It is
 * a category scale only: status is --pos, --warn and --neg. The share card
 * paints on a canvas and cannot read a token, so it takes the same table.
 *
 * The second design review (Oct 2026) set Z1 to #8499b0 and Z3 to a mid
 * violet, #8f7cf2 dark and #6a52d9 light: the pale lavender Z3 had read as
 * no colour beside Z2 and Z4 on the share card's route. Light Z1 keeps its
 * deeper slate, as #8499b0 is 2.9:1 on a white card and a zone is a mark
 * (3:1). Z5 stays rose, clear of --neg's coral.
 *
 * RunOmics 3.0 (Oct 2026) took the dark scale from the redesign handoff:
 * a cooler Z1, a softer orchid Z4 and a lighter rose Z5. Light keeps its
 * deeper steps, which a zone mark needs for 3:1 on a white card.
 */
export const ZONE_HEX = {
  light: ['#61788f', '#2f74e0', '#6a52d9', '#ae3cc2', '#d63a77'],
  dark: ['#8a9bb0', '#5b9cf5', '#8f7cf0', '#c77ae6', '#f07aa8'],
} as const

/**
 * Status, and only status (v4.17): good, caution, bad. Never a category - a
 * session type, a zone - and a delta takes one by what it means, not by
 * which way it moved: fatigue +6 is warn, fitness +4 is pos.
 *
 * Good is mint, fixed (3.0 override 2): "good is always #2dd4a7 and warning
 * always amber; lime #7fd13b is retired". v4.17.2 had made pos a yellower
 * green so it would not read as the teal accent's own data - but that put
 * lime on every delta the app prints, and the handoff would rather good and
 * the default accent match than have a third green. Mint matches the lime's
 * contrast exactly on a dark card (9.59:1), and light takes the palette's
 * own text-grade mint, 5.35:1 on a white card where the olive was 5.32.
 *
 * Light neg is #c0352a, not #c8372d: a missed day's "✕ 10 km" sits on its
 * own 12 % tint, where #c8372d read 4.35:1; now 4.6:1. Light warn is
 * #9a5b00, 5.4:1 on a card. Dark takes the 3.0 handoff's values: a softer
 * coral neg, so an error no longer reads as Z5.
 */
export const STATUS_HEX = {
  light: { pos: c.semGreenLight, warn: '#9a5b00', neg: '#c0352a' },
  dark: { pos: '#2dd4a7', warn: '#f0b73c', neg: '#ff8a80' },
} as const

/**
 * Neutral surfaces, the same under every accent (Whoop / Runna / Strava):
 * colour is for data and the active state, never for a background, a card, a
 * border or a shadow. The accent blocks below carry the accent roles only.
 */
export const SURFACES = {
  light: {
    background: '#f3f4f3',
    card: '#ffffff',
    raised: '#ffffff',
    line: '#e4e6e5',
    divider: '#e4e6e5',
    // Outline buttons and neutral bars (v4.17 line-2).
    line2: '#d3d6d4',
    text: '#141615',
    // Body and secondary text (v4.17 text-2).
    body: '#434846',
    // Labels and meta (v4.17 muted).
    text2: '#6b706e',
    // The map's street labels (v4.17 faint). Not for UI text: see subtle.
    text3: '#9aa09d',
    // Faint UI text at 4.5:1; on the light ground nothing lighter than the label grey reaches it.
    subtle: '#6b706e',
    tabBar: '#ffffff',
    // Tracks, inset tiles, the segmented control's ground (v4.17 surface-2).
    seg: '#f0f1f0',
    pill: '#ffffff',
    faint: '#f0f1f0',
    // Reference series and neutral bars: 3:1 or more on a card.
    band: '#8e9491',
    amber: STATUS_HEX.light.warn,
    shadowRaised: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  // RunOmics 3.0 (Oct 2026): the redesign handoff's dark ground - a
  // darker inset tile than the card, a sheet a step above it, and a
  // hairline divider a step under the card border.
  dark: {
    background: '#0b0c0c',
    card: '#141616',
    raised: '#1a1d1d',
    line: '#232626',
    // Dividers inside a card and the tab bar's top edge.
    divider: '#1f2222',
    line2: '#303432',
    text: '#f2f4f3',
    body: '#a3aaa7',
    text2: '#8d9391',
    text3: '#5b6563',
    // A step under text2 that still reaches 4.5:1.
    subtle: '#7f8482',
    tabBar: '#0d0f0f',
    // The inset tile and the segmented control's ground.
    seg: '#0f1111',
    // The active segment.
    pill: '#2a2e2d',
    // Empty tracks: gauges, progress bars, rest days.
    faint: '#262a29',
    band: '#6a706d',
    amber: STATUS_HEX.dark.warn,
    shadowRaised: 'none',
  },
} as const

function surfaceTokens(mode: 'light' | 'dark'): Record<string, string> {
  const n = SURFACES[mode]
  const status = STATUS_HEX[mode]
  return {
    '--background': n.background,
    // Flat: the page is one colour, no gradient and no aurora.
    '--canvas': n.background,
    '--card': n.card,
    '--raised': n.raised,
    '--popover': n.raised,
    '--muted': n.seg,
    '--surface-2': n.seg,
    // One line colour for borders, dividers and chart grids (v4.3 --line).
    '--border': n.line,
    '--divider': n.divider,
    // A second, stronger line: outline buttons, neutral bars (v4.17).
    '--line-2': n.line2,
    '--foreground': n.text,
    '--text-2': n.body,
    '--muted-foreground': n.text2,
    '--subtle': n.subtle,
    '--subtle-2': n.subtle,
    '--ro-text': n.text,
    '--ro-text-2': n.text2,
    '--ro-text-3': n.subtle,
    // Empty tracks, rest days and empty heatmap cells (--fa).
    '--track': n.faint,
    '--heat-empty': n.faint,
    // Neutral bars and reference series.
    '--band': n.band,
    '--thumb-bg': n.seg,
    '--tab-bar-bg': n.tabBar,
    '--tab-bar-hairline': n.divider,
    // Quiet tabs (v4.17): the track is surface-2, the active tab the card.
    '--segmented-track': n.seg,
    '--segmented-pill': n.pill,
    '--segmented-pill-shadow': '0 1px 2px rgba(0, 0, 0, 0.18)',
    '--pos': status.pos,
    '--warn': status.warn,
    '--neg': status.neg,
    // Caution and race only (--amb): the warn status.
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
 * The basemap's colours (v4.17), per theme. scripts/build-map-styles.ts bakes
 * these into the styles kept in src/map/styles, so the map can't drift from
 * the UI; labels and their halo are the UI's own muted, faint and ground.
 *
 * RunOmics 3.0 (Oct 2026): the map was "just tiles with a line on top".
 * Parks and water take a muted green and blue, and a hillshade under 7 %
 * gives the ground some relief; everything else stays grey, so the accent
 * route is still the one bright colour. Street names are fainter still.
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
    land: '#e6eae7',
    park: '#d3e6d0',
    water: '#c6dbee',
    waterway: '#c6dbee',
    building: SURFACES.light.line,
    roadMajor: '#ffffff',
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

/**
 * A colour as text on a ground, darkened in OKLCH lightness - hue and chroma
 * kept - only as far as 4.5:1 needs; a colour that already reads is itself.
 */
export function readableOn(hex: string, ground: string, ratio = TEXT_CONTRAST): string {
  const colour = hexToOklch(hex)
  let text = hex
  for (let l = colour.l; contrastRatio(text, ground) < ratio && l > 0; l -= 0.005) text = oklchToHex({ ...colour, l })
  return text
}

/**
 * One accent block (v4.3, v4.17): the palette's accent and its ink, and the
 * derived tints - `--accent-soft` (the accent at 1F alpha) for the active nav
 * row and soft fills, `--acc-line` for an accent outline. Accent text uses
 * `--accent-text`: the accent itself, except in light mode where the accent
 * reads under 4.5:1 on the page ground and inset tiles (3.0.2: teal was
 * 4.2:1 on #f3f4f3, 4.1:1 on #f0f1f0; pink 4.4:1 on a tile) - there it is
 * the accent a step darker, enough for the darkest light surface. On a
 * white card every accent already read; fills and rings keep the accent.
 */
export function accentTokens(accent: Pick<CuratedAccent, 'dark' | 'light'>, mode: 'light' | 'dark'): Record<string, string> {
  const { acc, onAcc } = accent[mode]
  return {
    '--accent': acc,
    '--accent-foreground': onAcc,
    '--accent-text': mode === 'light' ? readableOn(acc, SURFACES.light.seg) : acc,
    '--accent-hover': `color-mix(in oklab, ${acc} 88%, ${mode === 'dark' ? 'white' : 'black'})`,
    '--accent-soft': `${acc}1f`,
    '--acc-soft': `${acc}1f`,
    '--acc-line': `color-mix(in oklab, ${acc} 55%, transparent)`,
    '--ring': `color-mix(in oklab, ${acc} ${mode === 'dark' ? 70 : 35}%, transparent)`,
  }
}

/**
 * The roles the app names, each read off a status, a zone or a neutral
 * (v4.17). Nothing here has a hue of its own: a type is its zone, good news
 * is --pos, caution --warn, bad --neg, and a reference series is a grey.
 */
function semanticTokens(mode: 'light' | 'dark'): Record<string, string> {
  return {
    // A delta is coloured by what it means (v4.7, v4.17).
    '--delta-good': 'var(--pos)',
    '--delta-warn': 'var(--warn)',
    '--good': 'var(--pos)',
    '--destructive': 'var(--neg)',
    // Fitness is the solid text line, fatigue the dashed muted one; form is
    // drawn by its bands.
    '--metric-form': 'var(--foreground)',
    '--metric-fitness': 'var(--foreground)',
    '--metric-fatigue': 'var(--muted-foreground)',
    // The readiness tone on the Today hero's eyebrow: go is pos, hold warn.
    '--tone-go': 'var(--pos)',
    '--tone-hold': 'var(--warn)',
    // Garmin's "peaking" status (the app's `fresh`): good news.
    '--status-peaking': 'var(--pos)',
    // Form's named bands (domain/training/formBand): fresh pos, neutral
    // grey, tired warn - on Analytics and Today alike.
    '--form-band-tired': 'var(--warn)',
    '--form-band-neutral': 'var(--muted-foreground)',
    '--form-band-fresh': 'var(--pos)',
    '--form-band-very-fresh': 'var(--warn)',
    '--form-band-fill-fresh': 'var(--pos)',
    '--form-band-fill-neutral': 'var(--band)',
    '--form-band-fill-tired': 'var(--warn)',
    // Reference series set against the athlete's own (last year, done
    // weeks): the band grey, 3:1 or more on a card, and a muted third.
    '--series-2': 'var(--band)',
    '--series-3': 'var(--muted-foreground)',
    // The consistency ramp (v4.17.1): a rest day, then a day run as the
    // accent at a share per step - 8 km, 15 km, full. The two lowest steps
    // blurred on the pale ground, so light takes a lighter rest and a wider
    // gap between them. Shares, not colours, so the mix follows the accent
    // wherever a cell is drawn.
    // Steps wide enough to tell a rest day from the first level, in both themes.
    '--level-rest': mode === 'dark' ? '#262928' : '#eceeed',
    '--level-low': mode === 'dark' ? '35%' : '40%',
    '--level-mid': mode === 'dark' ? '65%' : '70%',
    // Ink for text on a zone fill (v4.17), per theme: white on the deeper
    // light-theme zones (4.4-8.7:1), the dark ink on the bright dark-theme
    // ones (5.6-9.3:1).
    '--zone-ink': mode === 'dark' ? c.roInk : '#ffffff',
    '--zone-1': ZONE_HEX[mode][0],
    '--zone-2': ZONE_HEX[mode][1],
    '--zone-3': ZONE_HEX[mode][2],
    '--zone-4': ZONE_HEX[mode][3],
    '--zone-5': ZONE_HEX[mode][4],
    '--chart-cadence': mode === 'dark' ? c.cadenceDark : c.cadenceLight,
    // Easy runs are Z2, workouts Z4, wherever the two are set side by side.
    '--chart-easy': 'var(--zone-2)',
    '--chart-hard': 'var(--zone-4)',
    '--chart-ground-contact': mode === 'dark' ? c.amber500 : c.amberLine,
    // The athlete's own data is the accent.
    '--chart-brand': 'var(--accent)',
    // Where the map's heat ends up where runs pile on: a deep accent shade in
    // light (multiply), the accent itself in dark (add). Dark used to run on
    // toward white, which read as a white route rather than a bright one;
    // the handoff caps it at the full accent (3.0 override 9, App Fixes 4a).
    '--heat-end': mode === 'dark' ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, #000000)',
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
      // A missed session is bad news: the neg status (v4.17).
      '--color-missed': 'var(--neg)',
      '--safe-top': 'env(safe-area-inset-top, 0px)',
      // Where a page starts: 4 px under the status bar. The bar is opaque
      // (statusBarStyle 'default'), so the top inset is 0 in the installed
      // app and the page begins below the bar, clear of the iOS blur - level
      // with a native app's first row (Garmin Connect's header).
      '--top-scrim': 'calc(var(--safe-top) + 4px)',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      // The tab bar's bottom padding: the inset less the 10 px under the home
      // indicator, so the labels stay clear of its swipe zone (the bar is 5 pt
      // tall, 8 pt from the edge) without floating 34 pt above the edge.
      '--tab-bar-bottom': 'max(calc(var(--safe-bottom) - 10px), 0px)',
      // The smallest touch target. `.hit-44` grows a control's hit area to it
      // without changing what it looks like.
      '--tap-min': '44px',
      // Session state is drawn in shape, so colour is free to mean intensity:
      // the .state-* recipes take the zone colour from --state-color.
      '--state-line': '1.5px',
      '--state-hatch': '40%',
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
    },
  },
  {
    selector: ':root',
    comment: 'Light tokens - Teal (default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.light,
      ...semanticTokens('light'),
      // Teal is the default accent, so the base block carries it.
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
      ...accentTokens(DEFAULT, 'dark'),
      ...surfaceTokens('dark'),
    },
  },
  ...CURATED_ACCENTS.filter((accent) => accent.id !== DEFAULT.id).flatMap(accentBlocks),
]
