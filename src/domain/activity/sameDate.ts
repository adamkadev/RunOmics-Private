/** Year-to-date against the same date last year is the one comparison every screen makes. */

/** Feb 29 falls back to Feb 28. */
export function sameDateLastYear(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4)) - 1
  const monthDay = todayIso.slice(5, 10)
  if (monthDay === '02-29') return `${year}-02-28`
  return `${year}-${monthDay}`
}

export function yearToDate<A extends { date: string }>(activities: readonly A[], year: number, cutoffIso: string): A[] {
  const prefix = String(year)
  return activities.filter((a) => a.date.startsWith(prefix) && a.date.slice(0, 10) <= cutoffIso)
}
