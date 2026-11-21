const PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/

/** A year ("2021") or a month ("2021-04"), typed by hand into athlete.json. */
export function isRunningSince(value: unknown): value is string {
  return typeof value === 'string' && PATTERN.test(value)
}

export function runningYears(since: string, today: string): number {
  const [year, month = 1] = since.split('-').map(Number) as [number, number?]
  const months = (Number(today.slice(0, 4)) - year) * 12 + (Number(today.slice(5, 7)) - month)
  return Math.max(0, Math.floor(months / 12))
}

export interface RunningSince {
  /** As typed: YYYY or YYYY-MM. */
  since: string
  years: number
}

/** Only when it goes back before the synced history, which otherwise says it better. */
export function runningSinceBefore(since: unknown, firstSynced: string | null, today: string): RunningSince | null {
  if (!isRunningSince(since)) return null
  if (firstSynced && since >= firstSynced.slice(0, since.length)) return null
  return { since, years: runningYears(since, today) }
}
