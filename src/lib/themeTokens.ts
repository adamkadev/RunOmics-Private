import { HUE, black, ink, paper, white, withAlpha } from './palette'
import {
  AURORA_2_HUE_OFFSET,
  CURATED_ACCENTS,
  CUSTOM_ACCENT_ID,
  curatedAccent,
  darkRoleHex,
  lightRoleHex,
  type CuratedAccent,
} from './accentScale'

export type TokenBlock = {
  selector: string
  comment?: string
  tokens: Record<string, string>
}

const c = HUE

const glassLight = {
  '--glass-sat': '1.4',
  '--glass-bg': paper(0.62),
  '--glass-border': paper(0.7),
  '--glass-highlight': paper(0.9),
  '--glass-shadow-float': `0 18px 40px -24px ${withAlpha(c.natureShadow, 0.35)}`,
  '--glass-shadow-nav': `0 16px 36px -20px ${withAlpha(c.natureShadow, 0.35)}`,
  '--glass-fallback': paper(0.96),
  '--glass-row-bg': paper(0.5),
  '--glass-bg-sheet': paper(0.94),
}

const glassDark = {
  '--glass-sat': '1.4',
  '--glass-bg': paper(0.03),
  '--glass-border': paper(0.07),
  '--glass-highlight': paper(0.05),
  '--glass-shadow-float': `0 24px 50px -26px ${ink(0.7)}`,
  '--glass-shadow-nav': `0 16px 36px -18px ${ink(0.8)}`,
  '--glass-fallback': c.natureCardDark,
  '--glass-row-bg': paper(0.03),
  '--glass-bg-sheet': withAlpha(c.natureBgDark, 0.92),
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
      '--hero-gradient': `linear-gradient(150deg, ${l('heroFrom')}, ${l('heroVia')} 70%, ${l('heroTo')})`,
      '--hero-glow': 'transparent',
      '--aurora-1': l('aurora1'),
      '--aurora-2': l('aurora2'),
      '--background': l('background'),
      '--canvas': `linear-gradient(155deg, ${l('canvasTop')} 0%, ${l('background')} 100%)`,
      // The tab bar is the page's own background, nearly opaque: at 0.72 white
      // headings scrolled under it read through the labels.
      '--glass-bg-nav': withAlpha(l('background'), 0.92),
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
    '--hero-gradient': `linear-gradient(155deg, ${withAlpha(d('accent'), 0.3)}, ${withAlpha(d('accent'), 0.1)} 55%, ${withAlpha(d('accent'), 0.03)})`,
    '--hero-glow': withAlpha(d('accent'), 0.28),
    '--aurora-1': d('aurora1'),
    '--aurora-2': d('aurora2'),
    '--background': d('background'),
    '--canvas': `linear-gradient(155deg, ${d('canvasTop')} 0%, ${d('background')} 100%)`,
    // Was a fixed Nature black at 0.6: content ghosted through the labels, and
    // on teal the bar sat on the canvas as a different colour.
    '--glass-bg-nav': withAlpha(d('background'), 0.9),
  }
}

const NATURE = curatedAccent('nature')

export const ACCENT_BACKGROUNDS: Record<string, [light: string, dark: string]> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [
    accent.id,
    [accentTokens(accent, 'light')['--background']!, accentTokens(accent, 'dark')['--background']!] as [string, string],
  ]),
)

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

const PAGE_AURORAS: Record<string, [string, string, number, number, number, number]> = {
  goals:     [c.roEmeraldDeep, c.roViolet,      0.45, 0.32, 0.2,  0.14],
  records:   [c.roViolet,      c.roEmeraldDeep, 0.42, 0.34, 0.18, 0.15],
  shoes:     [c.roOrange,      c.roEmeraldDeep, 0.38, 0.34, 0.16, 0.15],
  settings:  [c.roPink,        c.roViolet,      0.34, 0.28, 0.14, 0.12],
  analytics: [c.roBlue,        c.roEmeraldDeep, 0.42, 0.32, 0.18, 0.14],
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
      '--safe-top-min': 'max(var(--safe-top), 20px)',
      '--top-scrim': 'calc(var(--safe-top-min) + 28px)',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
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
      '--accent-gradient': `linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 74%, ${black}))`,
      '--shadow-toggle': `0 2px 6px ${ink(0.28)}`,
      '--shadow-modal': `0 8px 32px ${ink(0.55)}, 0 2px 8px ${ink(0.35)}`,
      '--shadow-thumb': `0 4px 12px ${ink(0.45)}`,
      '--shadow-hero': `0 10px 30px -12px ${ink(0.5)}`,
      '--brand-glow': withAlpha(c.roEmerald, 0.5),
      '--map-attrib-bg': ink(0.5),
      '--map-attrib-fg': paper(0.75),
    },
  },
  {
    selector: ':root',
    comment: 'Light tokens - Nature (emerald, default)',
    tokens: {
      '--shadow-card': `0 1px 3px 0 ${ink(0.06)}, 0 4px 16px -4px ${ink(0.09)}`,

      '--card': white,
      '--muted': c.slate100,
      '--border': c.slate200,
      '--foreground': c.inkLight,
      '--muted-foreground': c.inkLight2,
      '--subtle': c.inkLight3,
      '--subtle-2': c.inkLight4,
      '--delta-good': c.semGreenLight,
      '--delta-warn': c.semOrangeLight,
      '--metric-form': c.semGreenLight,
      '--metric-fitness': c.semBlueLight,
      '--metric-fatigue': c.semOrangeLight,
      '--destructive': c.semRedLight,
      '--track': withAlpha(c.roInk, 0.07),

      '--zone-1': c.roZone1,
      '--zone-2': c.blue500,
      '--zone-3': c.roEmeraldDeep,
      '--zone-4': c.roOrange,
      '--zone-5': c.roRed,

      '--ro-accent': c.roEmeraldDeep,
      '--ro-accent-hi': c.roEmeraldLift,
      '--ro-ink': c.roInk,
      '--ro-blur': '18px',
      '--ro-text': c.inkLight,
      '--ro-text-2': c.inkLight2,
      '--ro-text-3': c.inkLight3,

      '--aurora-1-opacity': '0.65',
      '--aurora-2-opacity': '0.6',
      '--aurora-blur': '28px',

      // Nature is the accent the base block carries, so it takes its accent
      // roles from the same generator as every other accent rather than from a
      // second, hand-tuned set - a swatch has to paint the theme it selects.
      ...accentTokens(NATURE, 'light'),

      ...glassLight,
    },
  },
  {
    selector: '.dark',
    comment: 'Dark tokens - Nature (emerald, default)',
    tokens: {
      '--shadow-card': `0 1px 2px 0 ${ink(0.35)}, 0 4px 16px -4px ${ink(0.7)}, inset 0 1px 0 0 ${paper(0.06)}`,

      '--card': c.natureCardDark,
      '--muted': paper(0.05),
      '--border': paper(0.07),
      '--foreground': c.inkDark,
      '--muted-foreground': c.inkDark2,
      '--subtle': c.inkDark3,
      '--subtle-2': c.inkDark4,
      '--delta-good': c.emerald400,
      '--delta-warn': c.orange400,
      '--metric-form': c.emerald400,
      '--metric-fitness': c.roBlueHi,
      '--metric-fatigue': c.roOrangeHi,
      '--destructive': c.red400,
      '--track': paper(0.08),

      '--zone-1': c.roZone1,
      '--zone-2': c.roBlueHi,
      '--zone-3': c.roEmeraldHi,
      '--zone-4': c.roOrangeHi,
      '--zone-5': c.roRed,

      '--ro-text': c.inkDark,
      '--ro-text-2': c.inkDark2,
      '--ro-text-3': c.inkDark3,

      '--aurora-1-opacity': '0.16',
      '--aurora-2-opacity': '0.12',
      '--aurora-blur': '30px',

      ...accentTokens(NATURE, 'dark'),

      ...glassDark,
    },
  },
  ...CURATED_ACCENTS.filter((accent) => accent.id !== NATURE.id).flatMap(accentBlocks),
  ...Object.entries(PAGE_AURORAS).flatMap(([page, [a1, a2, lo1, lo2, do1, do2]]): TokenBlock[] => [
    {
      selector: `[data-page-aurora="${page}"]`,
      tokens: {
        '--aurora-1': a1,
        '--aurora-2': a2,
        '--aurora-1-opacity': String(lo1),
        '--aurora-2-opacity': String(lo2),
      },
    },
    {
      selector: `.dark [data-page-aurora="${page}"]`,
      tokens: {
        '--aurora-1-opacity': String(do1),
        '--aurora-2-opacity': String(do2),
      },
    },
  ]),
]
