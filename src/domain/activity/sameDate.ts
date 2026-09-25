/**
 * Year-to-date against the same date last year: the one comparison the
 * Progress hub, Year over Year and the Month by Month sentence all make. They
 * used to disagree - the hub compared to the same date, Analytics to the whole
 * of last year - so one screen said +30% and the next said -11%.
 */

/** Today's month and day, one year earlier (Feb 29 falls back to Feb 28). */
export function sameDateLastYear(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4)) - 1
  const monthDay = todayIso.slice(5, 10)
  if (monthDay === '02-29') return `${year}-02-28`
  return `${year}-${monthDay}`
}

/** The activities of `year` up to and including `cutoffIso`. */
export function yearToDate<A extends { date: string }>(activities: readonly A[], year: number, cutoffIso: string): A[] {
  const prefix = String(year)
  return activities.filter((a) => a.date.startsWith(prefix) && a.date.slice(0, 10) <= cutoffIso)
}
