import { t } from '@/i18n'

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** From an hour, to the minute ("1:07" h); under it the seconds stay, as a 5K's time is read. */
export function formatDurationRounded(seconds: number): { value: string; unit: string } {
  if (Math.round(seconds) < 3600) return { value: formatClock(seconds), unit: t.units.min }
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return { value: `${h}:${String(m).padStart(2, '0')}`, unit: t.units.hour }
}

export function formatDurationWords(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')} ${t.units.hour}` : `${m} ${t.units.min}`
}

export function formatClock(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatPace(secPerKm: number): string {
  return `${formatClock(secPerKm)} /km`
}

/** A formatter costs ~40 format calls to build, and a list of runs formats hundreds of values. */
const numberFormats = new Map<string, Intl.NumberFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${t.locale}|${JSON.stringify(options)}`
  let format = numberFormats.get(key)
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(t.locale, options)))
  return format
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${t.locale}|${JSON.stringify(options)}`
  let format = dateFormats.get(key)
  if (!format) dateFormats.set(key, (format = new Intl.DateTimeFormat(t.locale, options)))
  return format
}

export const MINUS = '−'
export const PLUS_MINUS = '±'

/** A real minus, not a hyphen: a hyphen at 10px next to a digit reads as part of the number. */
export function formatDelta(value: number, unit?: string): string {
  const rounded = Math.round(value * 100) / 100
  const magnitude = numberSpaces(numberFormat({ maximumFractionDigits: 2 }).format(Math.abs(rounded)))
  const body = rounded === 0 ? `${PLUS_MINUS}0` : `${rounded > 0 ? '+' : MINUS}${magnitude}`
  return unit ? `${body} ${unit}` : body
}

export function formatPaceRange([fast, slow]: [number, number]): string {
  return `${formatClock(fast)}-${formatClock(slow)} /km`
}

const WHOLE_KM_FROM = 100

export function formatDistance(km: number): string {
  return formatKm(km, km >= WHOLE_KM_FROM ? 0 : 1)
}

/** The one thousands grouping for kilometre totals; i18n keys take an already-formatted string. */
export function formatKm(km: number, decimals = 0): string {
  return formatDecimal(km, decimals)
}

/** toFixed with the locale's decimal: toFixed always writes a point. */
export function formatDecimal(value: number, decimals: number): string {
  return numberSpaces(
    numberFormat({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
  )
}

/** `percent` is already in per cent (45 for 45 %). */
export function formatPercent(percent: number, maxDecimals = 0): string {
  return numberSpaces(numberFormat({ style: 'percent', maximumFractionDigits: maxDecimals }).format(percent / 100))
}

export function formatNumber(value: number, maxDecimals = 1): string {
  return numberSpaces(numberFormat({ maximumFractionDigits: maxDecimals }).format(value))
}

/** Whole kilometres on every screen, so a prescription never rounds one way here and another there. */
export function formatPlannedKm(km: number): string {
  return formatKm(km)
}

export function formatRanKm(km: number): string {
  return numberSpaces(numberFormat({ minimumFractionDigits: 0, maximumFractionDigits: km >= WHOLE_KM_FROM ? 0 : 1 }).format(km))
}

/* Dates hand Intl an option set and let it place the fields: spelling out `day month` inverts the order in French. */

export interface DateFormatOptions {
  precision?: 'day' | 'month'
  /** `always` is for a multi-year axis, where `auto` would put the year on some ticks only. */
  year?: 'auto' | 'never' | 'always'
  /** `full` is for aria-labels, so a screen reader does not have to guess at `Sat, Jun`. */
  style?: 'short' | 'bare' | 'full'
  now?: Date
}

/**
 * Every Unicode space separator, folded to U+0020: Node's ICU puts U+2009 around
 * a range dash where Chrome puts U+0020, and the mismatch breaks hydration.
 */
const UNICODE_SPACE_SEPARATORS = /[   -   　]/g

function stableSpaces(text: string): string {
  return text.replace(UNICODE_SPACE_SEPARATORS, ' ')
}

/** U+00A0 inside a number, so French "1 705" or "45 %" never wraps; one character, so hydration still matches. */
function numberSpaces(text: string): string {
  return text.replace(UNICODE_SPACE_SEPARATORS, '\u00a0')
}

function atMidnight(isoDate: string): Date {
  return new Date(isoDate + 'T00:00:00')
}

function dateFields(
  { precision = 'day', style = 'short' }: DateFormatOptions,
  showYear: boolean,
  dropWeekday = false
): Intl.DateTimeFormatOptions {
  const spelled = style === 'full'
  return {
    month: spelled ? 'long' : 'short',
    ...(precision === 'day' ? { day: 'numeric' } : {}),
    ...(precision === 'day' && style !== 'bare' && !dropWeekday
      ? { weekday: spelled ? 'long' : 'short' }
      : {}),
    ...(showYear ? { year: 'numeric' } : {}),
  }
}

/** A tick has about 40px, and the chart's own window label already says the year. */
export const AXIS_TICK_DATE: DateFormatOptions = { style: 'bare', year: 'never' }

export function formatDate(isoDate: string, options: DateFormatOptions = {}): string {
  const { year = 'auto', now = new Date() } = options
  const date = atMidnight(isoDate)
  const showYear =
    year === 'always' || (year === 'auto' && date.getFullYear() !== now.getFullYear())
  return stableSpaces(dateFormat(dateFields(options, showYear)).format(date))
}

export function formatWeekday(isoDate: string, withDay = false): string {
  const date = atMidnight(isoDate.slice(0, 10))
  const weekday = dateFormat({ weekday: 'short' }).format(date).replace(/\.$/, '')
  return stableSpaces(withDay ? `${weekday} ${date.getDate()}` : weekday)
}

/** The sync stores the weekday as English text; this one follows the locale. */
export function formatWeekdayLong(isoDate: string): string {
  return dateFormat({ weekday: 'long' }).format(atMidnight(isoDate.slice(0, 10)))
}

export function formatMonthShortYear(isoDate: string, options: DateFormatOptions = {}): string {
  const month = formatDate(isoDate, { ...options, precision: 'month', year: 'never' })
  return t.dates.monthShortYear(month, isoDate.slice(2, 4))
}

/** Not formatDateRange: a header this narrow needs the compact `'25`, not Intl's four-digit year. */
export function formatEraRange(startIso: string, endIso: string): string {
  const startMonth = formatDate(startIso, { precision: 'month', year: 'never' })
  const sameYear = startIso.slice(2, 4) === endIso.slice(2, 4)
  const start = sameYear ? startMonth : formatMonthShortYear(startIso)
  return `${start} - ${formatMonthShortYear(endIso)}`
}

/** A range never carries the weekday: formatRange would repeat it on both sides. */
export function formatDateRange(startIso: string, endIso: string, options: DateFormatOptions = {}): string {
  const { year = 'auto', now = new Date() } = options
  const start = atMidnight(startIso)
  const end = atMidnight(endIso)
  const showYear =
    year === 'always' ||
    (year === 'auto' &&
      (start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear()))
  if (year === 'never' && start.getFullYear() !== end.getFullYear()) {
    // formatRange adds both years across new year, so format each end and join them as the locale does.
    const format = dateFormat(dateFields(options, false, true))
    const join =
      format.formatRangeToParts(new Date(2000, 0, 31), new Date(2000, 1, 1)).find((p) => p.source === 'shared' && p.type === 'literal')?.value ??
      ' – '
    return stableSpaces(`${format.format(start)}${join}${format.format(end)}`)
  }
  return stableSpaces(
    dateFormat(dateFields(options, showYear, true)).formatRange(start, end)
  )
}

/** The two ends of the count are words: nobody says `D-0` on race morning. */
export function formatCountdown(days: number): string {
  const remaining = Math.max(0, Math.round(days))
  const r = t.nextRace
  return remaining === 0 ? r.today : remaining === 1 ? r.tomorrow : r.countdown(remaining)
}

/** Through formatDate, so a month is never spelled two ways on adjacent cards. */
export function monthName(month: number): string {
  const iso = `2000-${String(month).padStart(2, '0')}-01`
  return formatDate(iso, { precision: 'month', year: 'never' })
}

export function monthLabel(month: number): string {
  return monthName(month).toUpperCase()
}

export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days'

export function relativeTimeParts(iso: string, now: Date = new Date()): { unit: RelativeTimeUnit; value: number } {
  const diffMinutes = Math.floor(Math.max(0, now.getTime() - new Date(iso).getTime()) / 60_000)
  if (diffMinutes < 1) return { unit: 'now', value: 0 }
  if (diffMinutes < 60) return { unit: 'minutes', value: diffMinutes }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return { unit: 'hours', value: diffHours }
  return { unit: 'days', value: Math.floor(diffHours / 24) }
}

export function formatWeekdayTime(iso: string): string {
  const at = new Date(iso)
  const weekday = stableSpaces(dateFormat({ weekday: 'short' }).format(at).replace(/\.$/, ''))
  const time = stableSpaces(dateFormat({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at))
  return `${weekday} ${time}`
}

/** "17:27" on the athlete's clock: the app's time zone, Paris without one, whatever the device's. */
export function formatTimeOfDay(epochMs: number): string {
  const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE || 'Europe/Paris'
  return stableSpaces(dateFormat({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(epochMs)))
}

export function formatRelativeAgo(iso: string): string {
  const s = t.dashboard.syncStatus
  const { unit, value } = relativeTimeParts(iso)
  return unit === 'now' ? s.justNow :
    unit === 'minutes' ? s.minutesAgo(value) :
    unit === 'hours' ? s.hoursAgo(value) :
    s.daysAgo(value)
}

export function parseTimeInput(str: string): number | null {
  const parts = str.trim().split(':').map(Number)
  const [a, b, c] = parts
  if (parts.length === 2 && a !== undefined && b !== undefined && !parts.some(isNaN)) return a * 60 + b
  if (parts.length === 3 && a !== undefined && b !== undefined && c !== undefined && !parts.some(isNaN)) return a * 3600 + b * 60 + c
  return null
}

/** Keeps trailing zeros: a 5.0 % drift sits in a list of 4.6 % and 5.3 %, not as "5 %". */
export function formatDeltaFixed(value: number, decimals: number, unit?: string): string {
  const rounded = Number(value.toFixed(decimals))
  const magnitude = formatKm(Math.abs(rounded), decimals)
  const body = rounded === 0 ? `${PLUS_MINUS}${magnitude}` : `${rounded > 0 ? '+' : MINUS}${magnitude}`
  return unit ? `${body} ${unit}` : body
}
