/**
 * How long a personal best stays worth celebrating, and the one predicate that
 * decides it.
 *
 * A module of its own because `CelebrationOverlay` is a client component and
 * this rule used to live in `pbCelebrationInsight.ts`, next to the Gemini
 * prompt builders - which reach `insightHash.ts` and its `import { createHash }
 * from 'crypto'`. Importing a single number from there pulled Node's crypto
 * shim into the dashboard's browser bundle, for a comparison against 3.
 *
 * Both callers also spelled the same two-sided window out by hand, on
 * differently-derived day counts, so the predicate lives here too.
 */
export const CELEBRATION_WINDOW_DAYS = 3

/**
 * `days` is elapsed days, fractional. Negative means the record is dated in the
 * future - a clock skew or a bad import - and is never celebrated.
 */
export function isWithinCelebrationWindow(days: number): boolean {
  return days >= 0 && days <= CELEBRATION_WINDOW_DAYS
}

export function daysSinceRecordDate(date: string, now: Date): number {
  return (now.getTime() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000
}
