/** Local-time `YYYY-MM-DD`, matching the `date` field stored on activities. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(d.getDate() + n)
  return copy
}

/** Monday-based start of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const mondayOffset = (d.getDay() || 7) - 1
  return addDays(d, -mondayOffset)
}

/** ISO 8601 week number as `isoYear * 100 + isoWeek`, matching the sync pipeline's `week` field. */
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return isoYear * 100 + isoWeek
}

/** 1 (Monday) through 7 (Sunday) - how far into its week `now` falls. */
export function daysElapsedInWeek(now: Date): number {
  const midnightToday = new Date(isoDate(now) + 'T00:00:00')
  const monday = startOfWeek(midnightToday)
  return Math.round((midnightToday.getTime() - monday.getTime()) / 86_400_000) + 1
}
