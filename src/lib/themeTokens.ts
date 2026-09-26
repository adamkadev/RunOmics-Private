import { HUE, ink, paper, white, withAlpha } from './palette'
import {
  AURORA_2_HUE_OFFSET,
  CURATED_ACCENTS,
  CUSTOM_ACCENT_ID,
  curatedAccent,
  darkRoleHex,
  lightRoleHex,
  type CuratedAccent,
} from './accentScale'

/**
 * The opaque status bar's colour in an installed iPhone app, one per mode.
 * iOS stores it from the theme-color meta at install and only picks light or
 * dark at launch, so it can't follow the accent: it is a neutral close to
 * every accent's background, and the page top fades from it (--status-bar).
 */
export const STATUS_BAR_COLOR = { light: '#f4f5f4', dark: '#0a0b0b' } as const

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
    background: '#f4f5f4',
    card: '#ffffff',
    raised: '#ffffff',
    border: 'rgba(0, 0, 0, 0.06)',
    divider: 'rgba(0, 0, 0, 0.08)',
    text: '#111413',
    text2: '#5e6663',
    text3: '#8a918e',
    tabBar: '#ffffff',
    hairline: 'rgba(0, 0, 0, 0.08)',
    segTrack: '#e9ebea',
    segPill: '#ffffff',
    heatEmpty: '#e9ebea',
    shadowRaised: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  dark: {
    background: '#0a0b0b',
    card: '#141716',
    raised: '#1b1f1e',
    border: 'rgba(255, 255, 255, 0.06)',
    divider: 'rgba(255, 255, 255, 0.08)',
    text: '#f2f4f3',
    text2: '#9ba3a0',
    text3: '#6b7370',
    tabBar: '#0a0b0b',
    hairline: 'rgba(255, 255, 255, 0.08)',
    segTrack: '#1b1f1e',
    segPill: '#2a302e',
    heatEmpty: '#1b1f1e',
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
    '--muted': n.segTrack,
    '--border': n.border,
    '--divider': n.divider,
    '--foreground': n.text,
    '--muted-foreground': n.text2,
    '--subtle': n.text3,
    '--subtle-2': n.text3,
    '--ro-text': n.text,
    '--ro-text-2': n.text2,
    '--ro-text-3': n.text3,
    '--track': n.segTrack,
    '--thumb-bg': n.segTrack,
    '--heat-empty': n.heatEmpty,
    '--tab-bar-bg': n.tabBar,
    '--tab-bar-hairline': n.hairline,
    '--segmented-track': n.segTrack,
    '--segmented-pill': n.segPill,
    '--segmented-pill-shadow': mode === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
    '--shadow-card': 'none',
    '--shadow-raised': n.shadowRaised,
    '--shadow-hero': 'none',
    '--hero-gradient': n.card,
    '--hero-glow': 'transparent',
    '--glass-sat': '1',
    '--glass-bg': n.card,
    '--glass-border': n.border,
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
 * One accent block, from one hue. Every colour below is oklch(L C hue) with L
 * and C read off ACCENT_ROLES, so the block's shape, variable names and
 * relationships are what they always were - only the source of the hue moved.
 * Curated accents run this at build time (`npm run tokens`); a custom accent
 * runs it in the browser and injects the result (see customAccentCss).
 */
export function accentTokens(
  { hue, chromaScale }: { hue: number; chromaScale?: number },
  mode: 'light' | 'dark',
): Record<string, string> {
  const l = (role: Parameters<typeof lightRoleHex>[0]) =>
    lightRoleHex(role, role === 'aurora2' ? hue + AURORA_2_HUE_OFFSET : hue, chromaScale)
  const d = (role: Parameters<typeof darkRoleHex>[0]) =>
    darkRoleHex(role, role === 'aurora2' ? hue + AURORA_2_HUE_OFFSET : hue, chromaScale)

  if (mode === 'light') {
    return {
      '--accent': l('accent'),
      '--accent-hover': l('accentHover'),
      '--accent-dark': l('accentDark'),
      '--accent-foreground': white,
      '--accent-subtle': l('accentSubtle'),
      '--accent-text': l('accentText'),
      '--accent-on-dark': d('accentText'),
      '--ring': withAlpha(l('accent'), 0.35),
    }
  }

  return {
    '--accent': d('accent'),
    '--accent-hover': d('accentHover'),
    '--accent-dark': l('accent'),
    '--accent-foreground': d('accentInk'),
    '--accent-subtle': withAlpha(d('accent'), 0.1),
    '--accent-text': d('accentText'),
    '--accent-on-dark': d('accentText'),
    '--ring': withAlpha(d('accent'), 0.7),
  }
}

const NATURE = curatedAccent('nature')

function accentBlocks(accent: CuratedAccent): TokenBlock[] {
  return [
    { selector: `[data-accent="${accent.id}"]`, tokens: accentTokens(accent, 'light') },
    { selector: `.dark[data-accent="${accent.id}"]`, tokens: accentTokens(accent, 'dark') },
  ]
}

/**
 * The same two blocks as CSS text, for a hue that only exists at runtime. The
 * browser gets a stylesheet, not inline styles, so `.dark` still decides which
 * half applies and nothing has to be re-applied on a theme flip.
 */
export function customAccentCss(hue: number): string {
  const accent = { hue }
  const rule = (selector: string, tokens: Record<string, string>) => {
    const body = Object.entries(tokens)
      .map(([name, value]) => `${name}:${value}`)
      .join(';')
    return `${selector}{${body}}`
  }
  return [
    rule(`[data-accent="${CUSTOM_ACCENT_ID}"]`, accentTokens(accent, 'light')),
    rule(`.dark[data-accent="${CUSTOM_ACCENT_ID}"]`, accentTokens(accent, 'dark')),
  ].join('')
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
    comment: 'Light tokens - Nature (emerald, default)',
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
      '--tone-caution': c.amber700,
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
      '--zone-4': c.orange600,
      '--zone-5': c.red500,
      '--chart-cadence': c.sky600,
      '--chart-easy': c.roEmeraldDeep,
      '--chart-hard': c.orange600,
      '--chart-ground-contact': c.amberLine,
      '--chart-brand': c.roEmeraldDeep,

      '--ro-accent': c.roEmeraldDeep,
      '--ro-accent-hi': c.roEmeraldLift,
      '--ro-ink': c.roInk,
      '--ro-blur': '18px',


      // Nature is the accent the base block carries, so it takes its accent
      // roles from the same generator as every other accent rather than from a
      // second, hand-tuned set - a swatch has to paint the theme it selects.
      ...accentTokens(NATURE, 'light'),

      ...surfaceTokens('light'),
    },
  },
  {
    selector: '.dark',
    comment: 'Dark tokens - Nature (emerald, default)',
    tokens: {
      '--status-bar': STATUS_BAR_COLOR.dark,

      '--delta-good': 'var(--accent-text)',
      '--delta-warn': c.orange400,
      '--metric-form': c.emerald400,
      '--metric-fitness': c.roBlueHi,
      '--metric-fatigue': c.roOrangeHi,
      '--destructive': c.red400,
      '--tone-go': c.emerald400,
      '--tone-caution': c.roAmber,
      '--tone-hold': c.roOrangeHi,
      // Garmin's "peaking" status (the app's \`fresh\`), text grade per theme.
      '--status-peaking': c.violet400,
      // Form's named bands; the thresholds are domain/training/formBand.
      '--form-band-tired': 'var(--delta-warn)',
      '--form-band-neutral': 'var(--muted-foreground)',
      '--form-band-fresh': 'var(--delta-good)',
      '--form-band-very-fresh': 'var(--tone-caution)',

      '--zone-1': c.roZone1,
      '--zone-2': c.roBlueHi,
      '--zone-3': c.roEmeraldHi,
      '--zone-4': c.roOrangeHi,
      '--zone-5': c.roRed,
      '--chart-cadence': c.sky500,
      '--chart-easy': c.emerald400,
      '--chart-hard': c.orange400,
      '--chart-ground-contact': c.amber500,
      '--chart-brand': c.roEmerald,



      ...accentTokens(NATURE, 'dark'),

      ...surfaceTokens('dark'),
    },
  },
  ...CURATED_ACCENTS.filter((accent) => accent.id !== NATURE.id).flatMap(accentBlocks),
]
