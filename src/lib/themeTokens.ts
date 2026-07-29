// The CSS custom properties of globals.css, expressed in TypeScript.
//
// `scripts/generate-tokens.mjs` renders this into the generated region of
// `src/app/globals.css` - run `npm run tokens` after editing. Nothing here is
// read at runtime by the app; the browser only ever sees the generated CSS.
//
// Alias-free by necessity: the generator transpiles this file and its relative
// imports on the fly, and that mini-resolver only follows `./` specifiers - not `@/`.

import { HUE, black, ink, paper, white, withAlpha } from './palette'

export type TokenBlock = {
  selector: string
  /** Section banner emitted above the block. */
  comment?: string
  tokens: Record<string, string>
}

const c = HUE

// ── Glass surface sets ──────────────────────────────────────────────────────
// The frosted chrome (cards, nav, sheets). Light glass is white-on-white with a
// forest-tinted shadow; dark glass is white-alpha on the near-black canvas.

const glassLight = {
  '--glass-sat': '1.4',
  '--glass-bg': paper(0.62),
  '--glass-bg-nav': paper(0.72),
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
  '--glass-bg-nav': withAlpha(c.natureBgDark, 0.6),
  '--glass-border': paper(0.07),
  '--glass-highlight': paper(0.05),
  '--glass-shadow-float': `0 24px 50px -26px ${ink(0.7)}`,
  '--glass-shadow-nav': `0 16px 36px -18px ${ink(0.8)}`,
  '--glass-fallback': c.natureCardDark,
  '--glass-row-bg': paper(0.03),
  '--glass-bg-sheet': withAlpha(c.natureBgDark, 0.92),
}

// ── Accent variants ─────────────────────────────────────────────────────────
// Every non-default accent overrides the same shape, so it is described once
// here rather than repeated as two near-identical CSS blocks per theme.

type AccentVariant = {
  id: string
  light: {
    accent: string
    accentHover: string
    accentDark: string
    accentSubtle: string
    accentText: string
    ring: string
    destructive?: string
    heroFrom: string
    heroVia: string
    heroTo: string
    aurora1: string
    aurora2: string
    background: string
    canvasTop: string
    /** Defaults to `background`; silver deliberately lands a step darker. */
    canvasBottom?: string
  }
  dark: {
    accent: string
    accentHover: string
    accentText: string
    /** `--accent-foreground`: ink that reads on this hue's vivid fill. */
    accentInk: string
    ring: string
    aurora1: string
    aurora2: string
    auroraOpacity1?: string
    auroraOpacity2?: string
    background: string
    canvasTop: string
  }
}

const ACCENT_VARIANTS: AccentVariant[] = [
  {
    id: 'performance',
    light: {
      accent: c.blue500, accentHover: c.blue400, accentDark: c.blue600, accentSubtle: c.blue50, accentText: c.blue600, ring: withAlpha(c.blue500, 0.35),
      heroFrom: c.performanceHeroDeep, heroVia: c.blue900, heroTo: c.blue700,
      aurora1: c.blue300, aurora2: c.sky200,
      background: c.blue50, canvasTop: c.performanceCanvasTop,
    },
    dark: {
      accent: c.blue400, accentHover: c.blue300, accentText: c.blue300, accentInk: c.performanceInk, ring: withAlpha(c.blue400, 0.7),
      aurora1: c.blue700, aurora2: c.sky600,
      background: c.performanceBgDark, canvasTop: c.performanceCanvasDark,
    },
  },
  {
    id: 'impact',
    light: {
      accent: c.rose500, accentHover: c.rose400, accentDark: c.rose600, accentSubtle: c.rose50, accentText: c.rose600, ring: withAlpha(c.rose500, 0.35),
      destructive: c.red600,
      heroFrom: c.impactHeroFrom, heroVia: c.impactHeroVia, heroTo: c.impactHeroTo,
      aurora1: c.rose300, aurora2: c.pink200,
      background: c.rose50, canvasTop: c.impactCanvasTop,
    },
    dark: {
      accent: c.rose400, accentHover: c.rose300, accentText: c.rose300, accentInk: c.impactInk, ring: withAlpha(c.rose400, 0.7),
      aurora1: c.pink700, aurora2: c.pink800,
      background: c.impactBgDark, canvasTop: c.impactCanvasDark,
    },
  },
  {
    id: 'motivation',
    light: {
      accent: c.orange500, accentHover: c.orange400, accentDark: c.orange600, accentSubtle: c.orange50, accentText: c.orange600, ring: withAlpha(c.orange500, 0.35),
      destructive: c.red500,
      heroFrom: c.motivationHeroFrom, heroVia: c.motivationHeroVia, heroTo: c.motivationHeroTo,
      aurora1: c.orange300, aurora2: c.amber200,
      background: c.orange50, canvasTop: c.motivationCanvasTop,
    },
    dark: {
      accent: c.orange400, accentHover: c.orange300, accentText: c.orange300, accentInk: c.motivationInk, ring: withAlpha(c.orange400, 0.7),
      aurora1: c.orange700, aurora2: c.amber700,
      background: c.motivationBgDark, canvasTop: c.motivationCanvasDark,
    },
  },
  {
    id: 'endurance',
    light: {
      accent: c.violet500, accentHover: c.violet400, accentDark: c.violet600, accentSubtle: c.violet50, accentText: c.violet600, ring: withAlpha(c.violet500, 0.35),
      heroFrom: c.enduranceHeroDeep, heroVia: c.violet900, heroTo: c.violet700,
      aurora1: c.violet300, aurora2: c.purple200,
      background: c.violet50, canvasTop: c.enduranceCanvasTop,
    },
    dark: {
      accent: c.violet400, accentHover: c.violet300, accentText: c.violet300, accentInk: c.enduranceInk, ring: withAlpha(c.violet400, 0.7),
      aurora1: c.violet700, aurora2: c.purple700,
      background: c.enduranceBgDark, canvasTop: c.enduranceCanvasDark,
    },
  },
  {
    id: 'silver',
    light: {
      accent: c.slate500, accentHover: c.slate400, accentDark: c.slate600, accentSubtle: c.slate100, accentText: c.slate600, ring: withAlpha(c.slate500, 0.35),
      heroFrom: c.slate900, heroVia: c.slate800, heroTo: c.slate700,
      aurora1: c.slate300, aurora2: c.slate200,
      background: c.slate50, canvasTop: c.silverCanvasTop, canvasBottom: c.slate100,
    },
    dark: {
      accent: c.slate400, accentHover: c.slate300, accentText: c.slate300, accentInk: c.silverInk, ring: withAlpha(c.slate300, 0.5),
      aurora1: c.slate700, aurora2: c.slate800,
      auroraOpacity1: '0.6', auroraOpacity2: '0.5',
      background: c.silverBgDark, canvasTop: c.silverCanvasDark,
    },
  },
]

/**
 * The light `--background` / dark `--background` pair for each accent, which is
 * also what the iOS `theme-color` meta tag must match. Exported so `accent.ts`
 * and `ThemeColorUpdater` read the same values the CSS was generated from
 * instead of keeping their own copies.
 */
export const ACCENT_BACKGROUNDS: Record<string, [light: string, dark: string]> = {
  // Dark nature uses a lifted variant so the iOS status bar does not read as a
  // seam against the canvas gradient's top stop.
  nature: [c.natureBg, c.natureStatusDark],
  ...Object.fromEntries(
    ACCENT_VARIANTS.map((v) => [v.id, [v.light.background, v.dark.background] as [string, string]]),
  ),
}

function accentBlocks(v: AccentVariant): TokenBlock[] {
  const { light: l, dark: d } = v
  return [
    {
      selector: `[data-accent="${v.id}"]`,
      tokens: {
        '--accent': l.accent,
        '--accent-hover': l.accentHover,
        '--accent-dark': l.accentDark,
        '--accent-foreground': white,
        '--accent-subtle': l.accentSubtle,
        '--accent-text': l.accentText,
        '--accent-on-dark': d.accentText,
        '--ring': l.ring,
        ...(l.destructive ? { '--destructive': l.destructive } : {}),
        '--hero-gradient': `linear-gradient(150deg, ${l.heroFrom}, ${l.heroVia} 70%, ${l.heroTo})`,
        '--hero-glow': 'transparent',
        '--aurora-1': l.aurora1,
        '--aurora-2': l.aurora2,
        '--background': l.background,
        '--canvas': `linear-gradient(155deg, ${l.canvasTop} 0%, ${l.canvasBottom ?? l.background} 100%)`,
      },
    },
    {
      selector: `.dark[data-accent="${v.id}"]`,
      tokens: {
        '--accent': d.accent,
        '--accent-hover': d.accentHover,
        '--accent-dark': l.accent,
        '--accent-foreground': d.accentInk,
        '--accent-subtle': withAlpha(d.accent, 0.1),
        '--accent-text': d.accentText,
        '--accent-on-dark': d.accentText,
        '--ring': d.ring,
        '--destructive': c.red400,
        '--hero-gradient': `linear-gradient(155deg, ${withAlpha(d.accent, 0.30)}, ${withAlpha(d.accent, 0.10)} 55%, ${withAlpha(d.accent, 0.03)})`,
        '--hero-glow': withAlpha(d.accent, 0.28),
        '--aurora-1': d.aurora1,
        '--aurora-2': d.aurora2,
        ...(d.auroraOpacity1 ? { '--aurora-1-opacity': d.auroraOpacity1 } : {}),
        ...(d.auroraOpacity2 ? { '--aurora-2-opacity': d.auroraOpacity2 } : {}),
        '--background': d.background,
        '--canvas': `linear-gradient(155deg, ${d.canvasTop} 0%, ${d.background} 100%)`,
      },
    },
  ]
}

// ── Per-page aurora tints ───────────────────────────────────────────────────

// Each page keeps its two tints but carries an opacity pair per theme: the
// values are calibrated for the surface behind them, and the light canvas needs
// roughly triple the alpha the near-black one does before the wash reads at all.
// [tint1, tint2, lightOpacity1, lightOpacity2, darkOpacity1, darkOpacity2]
const PAGE_AURORAS: Record<string, [string, string, number, number, number, number]> = {
  goals:     [c.roEmeraldDeep, c.roViolet,      0.45, 0.32, 0.2,  0.14],
  records:   [c.roViolet,      c.roEmeraldDeep, 0.42, 0.34, 0.18, 0.15],
  shoes:     [c.roOrange,      c.roEmeraldDeep, 0.38, 0.34, 0.16, 0.15],
  settings:  [c.roPink,        c.roViolet,      0.34, 0.28, 0.14, 0.12],
  analytics: [c.roBlue,        c.roEmeraldDeep, 0.42, 0.32, 0.18, 0.14],
}

// ── The generated stylesheet ────────────────────────────────────────────────

export const TOKEN_BLOCKS: TokenBlock[] = [
  {
    selector: ':root',
    comment: 'Theme-independent tokens',
    tokens: {
      '--blur-sm': '8px',
      '--blur-md': '18px',
      '--blur-lg': '28px',
      '--saturate': '1.6',
      // Calendar status colors - intentionally fixed, not accent-dependent.
      '--color-today': c.roOrange,
      '--color-missed': c.roPink,
      // iOS safe area insets (viewport-fit: cover required in metadata viewport)
      // Rule: every position:sticky uses top: var(--safe-top);
      //       every position:fixed bottom edge uses padding-bottom: max(Npx, var(--safe-bottom))
      '--safe-top': 'env(safe-area-inset-top, 0px)',
      '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      // Utility inks. `--scrim` darkens a surface regardless of theme; the
      // `--track-*` pair is the empty half of a progress bar or segmented meter.
      '--scrim': ink(0.25),
      '--scrim-strong': ink(0.6),
      '--track-on-dark': paper(0.08),
      '--track-on-dark-strong': paper(0.18),
      // The accent, deepened toward black - the avatar/logo tile gradient shared
      // by ProfileHero and DashboardGreeting.
      '--accent-gradient': `linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 74%, ${black}))`,
      // Elevation for the share-card chrome, which floats over a dimmed backdrop
      // in both themes and so keeps a single fixed shadow.
      '--shadow-toggle': `0 2px 6px ${ink(0.28)}`,
      '--shadow-modal': `0 8px 32px ${ink(0.55)}, 0 2px 8px ${ink(0.35)}`,
      '--shadow-thumb': `0 4px 12px ${ink(0.45)}`,
      // TodayHero's panel, which is a fixed dark surface in both themes.
      '--shadow-hero': `0 10px 30px -12px ${ink(0.5)}`,
      // Fixed brand-green glow. Unlike --ring this does *not* follow the accent
      // picker; it marks "today" on the streak card in every theme.
      '--brand-glow': withAlpha(c.roEmerald, 0.5),
      // MapLibre's attribution control renders over satellite/dark tiles in both
      // themes, so it gets fixed inks rather than theme-aware ones.
      '--map-attrib-bg': ink(0.5),
      '--map-attrib-fg': paper(0.75),
    },
  },
  {
    selector: ':root',
    comment: 'Light tokens - Nature (emerald, default)',
    tokens: {
      '--shadow-card': `0 1px 3px 0 ${ink(0.06)}, 0 4px 16px -4px ${ink(0.09)}`,

      '--background': c.natureBg,
      '--card': white,
      '--muted': c.slate100,
      '--border': c.slate200,
      '--foreground': c.slate900,
      '--muted-foreground': c.slate500,
      '--subtle': c.slate400,
      '--subtle-2': c.roSteel,
      '--accent': c.roEmeraldDeep,
      '--accent-hover': c.roEmeraldLift,
      '--accent-dark': c.roEmeraldShade,
      '--accent-foreground': white,
      '--accent-subtle': c.emerald50,
      '--accent-text': c.emerald600,
      '--accent-on-dark': c.roEmeraldHi,
      '--destructive': c.red500,
      '--ring': withAlpha(c.roEmeraldDeep, 0.35),
      '--track': withAlpha(c.roInk, 0.07),

      // HR zone bars. Deeper than the chart ramp (ZONE_COLORS) because these are
      // wide filled bars on a pale card rather than thin marks on a plot.
      '--zone-1': c.roSage,
      '--zone-2': c.blue500,
      '--zone-3': c.roEmeraldDeep,
      '--zone-4': c.roOrange,
      '--zone-5': c.roRed,

      '--ro-accent': c.roEmeraldDeep,
      '--ro-accent-hi': c.roEmeraldLift,
      '--ro-ink': c.roInk,
      '--ro-blur': '18px',
      '--ro-text': c.roInk,
      '--ro-text-2': c.roInk2,
      '--ro-text-3': c.roInk3,

      '--canvas': `linear-gradient(155deg, ${c.natureCanvasTop} 0%, ${c.natureBg} 100%)`,
      '--hero-gradient': `linear-gradient(150deg, ${c.natureHeroDeep}, ${c.green900} 70%, ${c.green800})`,
      '--hero-glow': 'transparent',
      '--aurora-1': c.natureAurora1,
      '--aurora-2': c.natureAurora2,
      '--aurora-1-opacity': '0.65',
      '--aurora-2-opacity': '0.6',
      '--aurora-blur': '28px',

      ...glassLight,
    },
  },
  {
    selector: '.dark',
    comment: 'Dark tokens - Nature (emerald, default)',
    tokens: {
      '--shadow-card': `0 1px 2px 0 ${ink(0.35)}, 0 4px 16px -4px ${ink(0.7)}, inset 0 1px 0 0 ${paper(0.06)}`,

      '--background': c.natureBgDark,
      '--card': c.natureCardDark,
      '--muted': paper(0.05),
      '--border': paper(0.07),
      '--foreground': c.roInkInv,
      '--muted-foreground': c.roInkInv2,
      '--subtle': c.roInkInv3,
      '--subtle-2': c.roInkInv4,
      '--accent': c.roEmerald,
      '--accent-hover': c.roEmeraldHi,
      '--accent-dark': c.roEmeraldShadeDark,
      '--accent-foreground': c.roEmeraldInk,
      '--accent-subtle': withAlpha(c.roEmerald, 0.1),
      '--accent-text': c.roEmeraldHi,
      '--accent-on-dark': c.roEmeraldHi,
      '--destructive': c.red400,
      '--ring': withAlpha(c.roEmerald, 0.7),
      '--track': paper(0.08),

      '--zone-1': paper(0.55),
      '--zone-2': c.roBlueHi,
      '--zone-3': c.roEmeraldHi,
      '--zone-4': c.roOrangeHi,
      '--zone-5': c.roRed,

      '--ro-text': c.roInkInv,
      '--ro-text-2': c.roInkInv2,
      '--ro-text-3': c.roInkInv3,

      '--canvas': `linear-gradient(155deg, ${c.natureCanvasDark} 0%, ${c.natureBgDark} 100%)`,
      '--hero-gradient': `linear-gradient(155deg, ${withAlpha(c.roEmerald, 0.30)}, ${withAlpha(c.roEmerald, 0.10)} 55%, ${withAlpha(c.roEmerald, 0.03)})`,
      '--hero-glow': withAlpha(c.roEmerald, 0.28),
      '--aurora-1': c.roEmerald,
      '--aurora-2': c.roBlue,
      '--aurora-1-opacity': '0.16',
      '--aurora-2-opacity': '0.12',
      '--aurora-blur': '30px',

      ...glassDark,
    },
  },
  ...ACCENT_VARIANTS.flatMap(accentBlocks),
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
