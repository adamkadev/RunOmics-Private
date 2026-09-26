/**
 * The user's accent (v4.3, v4.3.2): five fixed palettes, one pair of colours per
 * mode. The accent fills selected states, marks today and the one hero card
 * per screen; surfaces stay neutral. No blue, orange, red or amber: they are
 * zone and caution colours, and an accent in their hue would read as data -
 * no sky, cyan or royal blue either, beside Z2 and the cadence line. The set
 * stays curated: a free colour could clash with a zone or fail contrast.
 */
export type AccentId = 'lavender' | 'indigo' | 'teal' | 'pink' | 'mono'

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

export const CURATED_ACCENTS: readonly CuratedAccent[] = [
  { id: 'lavender', dark: { acc: '#b48cf0', onAcc: '#1a0f2e' }, light: { acc: '#7c3aed', onAcc: '#ffffff' } },
  // Between Z2's sky blue and lavender (v4.3.2), so it never reads as a zone.
  { id: 'indigo', dark: { acc: '#8c9bff', onAcc: '#0e1238' }, light: { acc: '#4338ca', onAcc: '#ffffff' } },
  // Light teal a step darker than the spec's #0f8a6e (4.3:1): white on it is 4.65:1.
  { id: 'teal', dark: { acc: '#2fd1a6', onAcc: '#03201a' }, light: { acc: '#0e8468', onAcc: '#ffffff' } },
  { id: 'pink', dark: { acc: '#ff7ac0', onAcc: '#2e0a1d' }, light: { acc: '#c2257a', onAcc: '#ffffff' } },
  { id: 'mono', dark: { acc: '#f2f3f3', onAcc: '#0b0c0c' }, light: { acc: '#141616', onAcc: '#ffffff' } },
]

export const ACCENT_IDS: readonly AccentId[] = CURATED_ACCENTS.map((accent) => accent.id)

/**
 * Accents a reader may have saved before v4.3, read as their nearest
 * palette: green and teal to teal, blue and violet to lavender, silver to
 * mono, and v4.3's lime to the default. A custom hue has no palette and
 * takes the default.
 */
export const LEGACY_ACCENTS: Readonly<Record<string, AccentId>> = {
  nature: 'teal',
  performance: 'lavender',
  endurance: 'lavender',
  silver: 'mono',
  // Lime left the set in v4.3.2.
  lime: 'lavender',
}

export function curatedAccent(id: AccentId): CuratedAccent {
  return CURATED_ACCENTS.find((accent) => accent.id === id) ?? CURATED_ACCENTS[0]!
}
