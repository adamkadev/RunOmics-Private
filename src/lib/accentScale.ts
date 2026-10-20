/**
 * The user's accent (v4.3, v4.17): five fixed palettes, one colour per mode.
 * The accent marks the athlete's own data - weekly bars, the year line, the
 * heatmap tracks, the route - and the real actions and the active nav row;
 * surfaces stay neutral. The set stays curated: a free colour could clash
 * with a zone or a status colour, or fail contrast.
 */
export type AccentId = 'teal' | 'cyan' | 'violet' | 'pink' | 'mono'

export interface AccentPair {
  /** The accent itself: fills, outlines, accent text at 14 px bold and up. */
  acc: string
  /** Ink on an `acc` fill: 4.5:1 or better in every palette. */
  onAcc: string
}

export interface CuratedAccent {
  id: AccentId
  dark: AccentPair
  light: AccentPair
}

/** Ink on any accent fill (v4.17): a deep teal-black on dark, white on light. */
const ACCENT_INK = { dark: '#07261d', light: '#ffffff' } as const

export const CURATED_ACCENTS: readonly CuratedAccent[] = [
  // Teal is the default and comes first (v4.9.1).
  // Light teal a step darker than the spec's #0f8a6a (4.3:1): white on it is 4.65:1.
  { id: 'teal', dark: { acc: '#2dd4a7', onAcc: ACCENT_INK.dark }, light: { acc: '#0e8468', onAcc: ACCENT_INK.light } },
  // Cyan replaces the blue (3.1, App Fixes 5b): a periwinkle today-ring sat
  // beside an easy run's blue bar and read as another easy run. The light
  // value is the same hue darkened - #5fd4f0 is 1.7:1 on white.
  { id: 'cyan', dark: { acc: '#5fd4f0', onAcc: ACCENT_INK.dark }, light: { acc: '#0e7f9b', onAcc: ACCENT_INK.light } },
  { id: 'violet', dark: { acc: '#b794f6', onAcc: ACCENT_INK.dark }, light: { acc: '#7a4fd1', onAcc: ACCENT_INK.light } },
  { id: 'pink', dark: { acc: '#f58ac0', onAcc: ACCENT_INK.dark }, light: { acc: '#c23a83', onAcc: ACCENT_INK.light } },
  // Mono is the text colour, so its ink flips to the page ground.
  { id: 'mono', dark: { acc: '#edefee', onAcc: '#0c0d0d' }, light: { acc: '#1a1c1b', onAcc: ACCENT_INK.light } },
]

export const ACCENT_IDS: readonly AccentId[] = CURATED_ACCENTS.map((accent) => accent.id)

/**
 * Accents a reader may have saved before v4.3, read as their nearest
 * palette: green and teal to teal, blue and violet to violet, silver to
 * mono, and v4.3's lime to the default; v4.3's indigo and lavender to the
 * v4.17 periwinkle and violet. A custom hue has no palette and takes the
 * default.
 */
export const LEGACY_ACCENTS: Readonly<Record<string, AccentId>> = {
  nature: 'teal',
  performance: 'violet',
  endurance: 'violet',
  silver: 'mono',
  // Lime left the set in v4.3.2 and reads as the default.
  lime: 'teal',
  // Renamed in v4.17 with their new colours.
  indigo: 'cyan',
  // v4.17's periwinkle, the blue cyan replaced in 3.1.
  periwinkle: 'cyan',
  lavender: 'violet',
}

export function curatedAccent(id: AccentId): CuratedAccent {
  return CURATED_ACCENTS.find((accent) => accent.id === id) ?? CURATED_ACCENTS[0]!
}
