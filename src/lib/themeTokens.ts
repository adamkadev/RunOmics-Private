import { HUE, ink, paper } from './palette'
import { CURATED_ACCENTS, curatedAccent, type CuratedAccent } from './accentScale'

/**
 * The opaque status bar's colour in an installed iPhone app, one per mode.
 * iOS stores it from the theme-color meta at install and only picks light or
 * dark at launch, so it can't follow the accent: it is a neutral close to
 * every accent's background, and the page top fades from it (--status-bar).
 */
export const STATUS_BAR_COLOR = { light: '#f3f4f4', dark: '#0b0c0c' } as const

export type TokenBlock = {
  selector: string
  comment?: string
  tokens: Record<string, string>
}

const c = HUE

/**
 * Neutral surfaces, the same under every accent (Whoop / Runna / Strava):
 * colour is for data and the active state, never for a background, a card, a
 * border or a shadow. The accent blocks below carry the accent roles only.
 */
export const SURFACES = {
  light: {
    background: '#f3f4f4',
    card: '#ffffff',
    raised: '#ffffff',
    line: '#e4e6e6',
    text: '#111313',
    text2: '#6b7070',
    text3: '#8a8f8f',
    tabBar: '#ffffff',
    seg: '#e6e8e8',
    faint: '#e8eaea',
    band: '#c9cdcd',
    amber: '#b45309',
    shadowRaised: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  dark: {
    background: '#0b0c0c',
    card: '#161818',
    raised: '#1d2020',
    line: '#252828',
    text: '#f2f3f3',
    text2: '#9a9f9f',
    text3: '#6e7373',
    tabBar: '#0b0c0c',
    seg: '#1d2020',
    faint: '#262a2a',
    band: '#3a3f3f',
    amber: '#f5b83d',
    shadowRaised: 'none',
  },
} as const

function surfaceTokens(mode: 'light' | 'dark'): Record<string, string> {
  const n = SURFACES[mode]
  return {
    '--background': n.background,
    // Flat: the page is one colour, no gradient and no aurora.
    '--canvas': n.background,
    '--card': n.card,
    '--raised': n.raised,
    '--popover': n.raised,
    '--muted': n.seg,
    // One line colour for borders, dividers and chart grids (v4.3 --line).
    '--border': n.line,
    '--divider': n.line,
    '--foreground': n.text,
    '--muted-foreground': n.text2,
    '--subtle': n.text3,
    '--subtle-2': n.text3,
    '--ro-text': n.text,
    '--ro-text-2': n.text2,
    '--ro-text-3': n.text3,
    // Empty tracks, rest days and empty heatmap cells (--fa).
    '--track': n.faint,
    '--heat-empty': n.faint,
    // The interval band and recovery reps.
    '--band': n.band,
    '--thumb-bg': n.seg,
    '--tab-bar-bg': n.tabBar,
    '--tab-bar-hairline': n.line,
    '--segmented-track': n.seg,
    '--segmented-pill': n.raised,
    '--segmented-pill-shadow': mode === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
    // Caution and race only (--amb).
    '--tone-caution': n.amber,
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
 * One accent block (v4.3): the palette's accent and its ink, and the two
 * derived tints - `--acc-soft` for the tab bar's active pill only, and
 * `--acc-line` for the one hero card per screen. Accent text uses
 * `--accent-text`, the accent itself, and only at 14 px bold and up.
 */
export function accentTokens(accent: Pick<CuratedAccent, 'dark' | 'light'>, mode: 'light' | 'dark'): Record<string, string> {
  const { acc, onAcc } = accent[mode]
  return {
    '--accent': acc,
    '--accent-foreground': onAcc,
    '--accent-text': acc,
    '--accent-hover': `color-mix(in oklab, ${acc} 88%, ${mode === 'dark' ? 'white' : 'black'})`,
    '--acc-soft': `color-mix(in oklab, ${acc} 20%, transparent)`,
    '--acc-line': `color-mix(in oklab, ${acc} 55%, transparent)`,
    '--ring': `color-mix(in oklab, ${acc} ${mode === 'dark' ? 70 : 35}%, transparent)`,
  }
}

const DEFAULT = curatedAccent('lavender')

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
      '--color-missed': c.roPink,
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
      // Ink for text on a zone fill: over 7:1 on Z3 and Z4 in both themes.
      '--zone-ink': c.roInk,
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
    comment: 'Light tokens - Lavender (default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.light,

      // Positive deltas are the accent's to paint (neutral surfaces).
      '--delta-good': 'var(--accent-text)',
      '--delta-warn': c.semOrangeLight,
      '--metric-form': c.semGreenLight,
      '--metric-fitness': c.semBlueLight,
      '--metric-fatigue': c.semOrangeLight,
      '--destructive': c.semRedLight,
      // The readiness tone on the Today hero's eyebrow and rule, text grade.
      '--tone-go': c.semGreenLight,
      '--tone-hold': c.semOrangeLight,
      // Garmin's "peaking" status (the app's \`fresh\`), text grade per theme.
      '--status-peaking': c.violet600,
      // Form's named bands; the thresholds are domain/training/formBand.
      '--form-band-tired': 'var(--delta-warn)',
      '--form-band-neutral': 'var(--muted-foreground)',
      '--form-band-fresh': 'var(--delta-good)',
      '--form-band-very-fresh': 'var(--tone-caution)',

      // Every zone and chart line clears 3:1 on white; the three that did not
      // (Z1 2.3, Z4 2.9, Z5 2.6) are a step darker here, and only here.
      '--zone-1': c.roZone1Light,
      '--zone-2': c.blue500,
      '--zone-3': c.roEmeraldDeep,
      '--zone-4': c.zone4Light,
      '--zone-5': c.zone5Light,
      '--chart-cadence': c.sky600,
      '--chart-easy': c.roEmeraldDeep,
      '--chart-hard': c.orange600,
      '--chart-ground-contact': c.amberLine,
      '--chart-brand': c.roEmeraldDeep,

      '--ro-accent': c.roEmeraldDeep,
      '--ro-accent-hi': c.roEmeraldLift,
      '--ro-ink': c.roInk,
      '--ro-blur': '18px',


      // Lavender is the default accent, so the base block carries it.
      ...accentTokens(DEFAULT, 'light'),

      ...surfaceTokens('light'),
    },
  },
  {
    selector: '.dark',
    comment: 'Dark tokens - Lavender (default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.dark,

      '--delta-good': 'var(--accent-text)',
      '--delta-warn': c.orange400,
      '--metric-form': c.emerald400,
      '--metric-fitness': c.roBlueHi,
      '--metric-fatigue': c.roOrangeHi,
      '--destructive': c.red400,
      '--tone-go': c.emerald400,
      '--tone-hold': c.roOrangeHi,
      // Garmin's "peaking" status (the app's \`fresh\`), text grade per theme.
      '--status-peaking': c.violet400,
      // Form's named bands; the thresholds are domain/training/formBand.
      '--form-band-tired': 'var(--delta-warn)',
      '--form-band-neutral': 'var(--muted-foreground)',
      '--form-band-fresh': 'var(--delta-good)',
      '--form-band-very-fresh': 'var(--tone-caution)',

      '--zone-1': c.roZone1,
      '--zone-2': c.zone2Dark,
      '--zone-3': c.roEmeraldHi,
      '--zone-4': c.zone4Dark,
      '--zone-5': c.zone5Dark,
      '--chart-cadence': c.sky500,
      '--chart-easy': c.emerald400,
      '--chart-hard': c.orange400,
      '--chart-ground-contact': c.amber500,
      '--chart-brand': c.roEmerald,



      ...accentTokens(DEFAULT, 'dark'),

      ...surfaceTokens('dark'),
    },
  },
  ...CURATED_ACCENTS.filter((accent) => accent.id !== DEFAULT.id).flatMap(accentBlocks),
]
