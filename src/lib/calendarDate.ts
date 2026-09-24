export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(d.getDate() + n)
  return copy
}

export function startOfWeek(d: Date): Date {
  const mondayOffset = (d.getDay() || 7) - 1
  return addDays(d, -mondayOffset)
}

export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return isoYear * 100 + isoWeek
}

/**
 * Today's date in `timeZone`, an IANA name such as 'Europe/Luxembourg'. With
 * no zone it is the local date of whichever machine runs this - what
 * isoDate(new Date()) has always meant.
 */
export function todayIso(timeZone?: string, now: Date = new Date()): string {
  if (!timeZone) return isoDate(now)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * The app's today. A page is prerendered on a server (UTC on Vercel) and read
 * in a browser, and each used to take the date from its own clock; with
 * NEXT_PUBLIC_TIME_ZONE set, both read it in the athlete's zone. Unset, it is
 * the local date, as before.
 */
export function appTodayIso(now: Date = new Date()): string {
  return todayIso(process.env.NEXT_PUBLIC_TIME_ZONE || undefined, now)
}
