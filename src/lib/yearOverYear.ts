/**
 * From 1 January, unless the synced history starts later in last year: then
 * both years count from that date (`since`), so the months before it never
 * read as growth.
 */
export interface YearOverYear {
  km: number
  lastYearKm: number
  since: string | null
}

export function yearOverYear(runs: readonly { date: string; distanceKm: number }[], today: string): YearOverYear | null {
  const year = Number(today.slice(0, 4))
  const dated = runs.map((r) => ({ date: r.date.slice(0, 10), km: r.distanceKm })).filter((r) => r.date <= today)
  if (!dated.some((r) => r.date.startsWith(String(year - 1)))) return null
  const first = dated.reduce((min, r) => (r.date < min ? r.date : min), today)
  const since = first > `${year - 1}-01-01` ? first : null
  const from = since ? since.slice(5) : '01-01'
  const kmBetween = (start: string, end: string) =>
    Math.round(dated.reduce((sum, r) => (r.date >= start && r.date <= end ? sum + r.km : sum), 0))
  return {
    km: kmBetween(`${year}-${from}`, today),
    lastYearKm: kmBetween(`${year - 1}-${from}`, `${year - 1}${today.slice(4, 10)}`),
    since,
  }
}
