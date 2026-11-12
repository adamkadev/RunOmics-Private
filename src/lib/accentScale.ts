/** The set stays curated: a free colour could clash with a zone or a status colour, or fail contrast. */
export type AccentId = 'teal' | 'cyan' | 'heather'

export interface AccentPair {
  /** Fills, outlines, and accent text only at 14 px bold and up. */
  acc: string
  /** Ink on an `acc` fill: 4.5:1 or better in every palette. */
  onAcc: string
}

export interface CuratedAccent {
  id: AccentId
  dark: AccentPair
  light: AccentPair
}

const ACCENT_INK = { dark: '#07261d', light: '#ffffff' } as const

export const CURATED_ACCENTS: readonly CuratedAccent[] = [
  // Teal is the default and comes first. Light teal is a step darker than #0f8a6a (4.3:1): white on it is 4.65:1.
  { id: 'teal', dark: { acc: '#2dd4a7', onAcc: ACCENT_INK.dark }, light: { acc: '#0e8468', onAcc: ACCENT_INK.light } },
  // Cyan, not blue: a blue accent reads as an easy run's bar. Light is the same hue darkened - #5fd4f0 is 1.7:1 on white.
  { id: 'cyan', dark: { acc: '#5fd4f0', onAcc: ACCENT_INK.dark }, light: { acc: '#0e7f9b', onAcc: ACCENT_INK.light } },
  // A muted blush: violet and pink read as the Z4 and Z5 session colours, this one stays 10+ OKLab ΔE from both and from red.
  { id: 'heather', dark: { acc: '#d8a6c0', onAcc: ACCENT_INK.dark }, light: { acc: '#8e5470', onAcc: ACCENT_INK.light } },
]

export const ACCENT_IDS: readonly AccentId[] = CURATED_ACCENTS.map((accent) => accent.id)

/** Retired accent ids a reader may still have saved, read as their nearest palette. */
export const LEGACY_ACCENTS: Readonly<Record<string, AccentId>> = {
  nature: 'teal',
  violet: 'heather',
  pink: 'heather',
  mono: 'teal',
  performance: 'heather',
  endurance: 'heather',
  silver: 'teal',
  lime: 'teal',
  indigo: 'cyan',
  periwinkle: 'cyan',
  lavender: 'heather',
}

export function curatedAccent(id: AccentId): CuratedAccent {
  return CURATED_ACCENTS.find((accent) => accent.id === id) ?? CURATED_ACCENTS[0]!
}
