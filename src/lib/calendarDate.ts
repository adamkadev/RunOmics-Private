export const DAY_MS = 86_400_000

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
  const isoWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return isoYear * 100 + isoWeek
}

/** `timeZone` is an IANA name such as 'Europe/Luxembourg'; without one it is the local date of whichever machine runs this. */
export function todayIso(timeZone?: string, now: Date = new Date()): string {
  if (!timeZone) return isoDate(now)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** A page is prerendered on a server (UTC on Vercel) and read in a browser; NEXT_PUBLIC_TIME_ZONE makes both read today in the athlete's zone. */
export function appTodayIso(now: Date = new Date()): string {
  return todayIso(process.env.NEXT_PUBLIC_TIME_ZONE || undefined, now)
}

function zoneOffsetMs(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - Math.floor(at / 1000) * 1000
}

/** Epoch ms of `hour` o'clock on `date` ('YYYY-MM-DD') in `timeZone`, summer time included. */
export function wallClockMs(date: string, hour: number, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const asUtc = Date.UTC(year, month - 1, day, Math.floor(hour), Math.round((hour % 1) * 60))
  const first = asUtc - zoneOffsetMs(timeZone, asUtc)
  return asUtc - zoneOffsetMs(timeZone, first)
}

/** The hour, with its minutes as a fraction, on `timeZone`'s clock. */
export function wallClockHour(at: number, timeZone: string): number {
  const sinceMidnight = (((at + zoneOffsetMs(timeZone, at)) % DAY_MS) + DAY_MS) % DAY_MS
  return sinceMidnight / 3_600_000
}
