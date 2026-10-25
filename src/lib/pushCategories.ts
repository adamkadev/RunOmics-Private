export const PUSH_CATEGORIES = ['training', 'shoes', 'records'] as const

export type PushCategory = (typeof PUSH_CATEGORIES)[number]

export type PushCategories = Record<PushCategory, boolean>

/** Sync, token and workflow failures: the athlete must hear about them whatever the switches say. */
export type PushAudience = PushCategory | 'always'

/** A device registered before categories existed has none stored, and keeps getting everything. */
export function wantsPush(stored: unknown, audience: PushAudience): boolean {
  if (audience === 'always' || typeof stored !== 'object' || stored === null) return true
  return (stored as Partial<Record<PushCategory, unknown>>)[audience] !== false
}
