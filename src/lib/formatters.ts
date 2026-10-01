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

export function formatDurationWords(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}${t.units.hour}${String(m).padStart(2, '0')}` : `${m} ${t.units.min}`
}

/**
 * Same breakdown as `formatDurationWords`, but always carries the hour digit
 * (`0h22`, not `22 min`) - a list mixing both is two duration formats fighting
 * for the reader's attention, not one dominant number and a bunch of context.
 */
export function formatDurationCompact(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}${t.units.hour}${String(m).padStart(2, '0')}`
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

export const MINUS = '−'
export const PLUS_MINUS = '±'

/**
 * The one shape every delta in the app takes: sign, value, unit. A real minus
 * rather than a hyphen, because a hyphen at 10px next to a digit reads as part
 * of the number.
 */
export function formatDelta(value: number, unit?: string): string {
  const rounded = Math.round(value * 100) / 100
  const magnitude = stableSpaces(Math.abs(rounded).toLocaleString(t.locale, { maximumFractionDigits: 2 }))
  const body = rounded === 0 ? `${PLUS_MINUS}0` : `${rounded > 0 ? '+' : MINUS}${magnitude}`
  return unit ? `${body} ${unit}` : body
}

/** A signed time delta, in m:ss or h:mm:ss - never a bare count of seconds. */
export function formatSignedDuration(seconds: number, unit?: string): string {
  const rounded = Math.round(seconds)
  const sign = rounded > 0 ? '+' : rounded < 0 ? MINUS : ''
  const body = `${sign}${formatDuration(Math.abs(rounded))}`
  return unit ? `${body} ${unit}` : body
}

export function formatPaceRange([fast, slow]: [number, number]): string {
  return `${formatClock(fast)}-${formatClock(slow)} /km`
}

export function formatDistance(km: number): string {
  // Through formatKm, so the decimal follows the locale: toFixed always wrote
  // a point, and the French build showed "9.26" beside "1 321,5".
  return formatKm(km, km >= 10 ? 1 : 2)
}

/**
 * The one thousands convention for kilometre totals. The annual-goal card used
 * to show `1321`, `2000` and `1,705` side by side because each number was
 * grouped (or not) at its own call site, and the i18n strings that did group
 * hardcoded 'en-US' / 'fr-FR' instead of following t.locale. Grouping lives
 * here now; the i18n keys take an already-formatted string.
 */
export function formatKm(km: number, decimals = 0): string {
  return formatDecimal(km, decimals)
}

/** Any figure at a fixed number of decimals, as toFixed would - with the locale's decimal: toFixed always wrote a point. */
export function formatDecimal(value: number, decimals: number): string {
  return stableSpaces(
    value.toLocaleString(t.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  )
}

/** Any other figure in running text (a form value, a weekly rate): the locale's decimal, at most `maxDecimals`. */
export function formatNumber(value: number, maxDecimals = 1): string {
  return stableSpaces(value.toLocaleString(t.locale, { maximumFractionDigits: maxDecimals }))
}

/**
 * A planned distance, as every screen writes it: whole kilometres ("6 km").
 * Plan, Today and the run verdict each rounded the same 6.11 km prescription
 * their own way (6, 6.1, 6.1), so planned and ran looked equal on one screen
 * and apart on the next. A ran distance keeps formatDistance.
 */
export function formatPlannedKm(km: number): string {
  return formatKm(km)
}

/** A ran distance in a list or a total: formatDistance's precision without a
 *  trailing zero, so a week reads "6.11 of 52 km" and "4.8 of 13 km". */
export function formatRanKm(km: number): string {
  return stableSpaces(km.toLocaleString(t.locale, { minimumFractionDigits: 0, maximumFractionDigits: km >= 10 ? 1 : 2 }))
}

/*
 * ---------------------------------------------------------------------------
 * Dates: one policy, three formatters.
 *
 * There were ten date formatters here and two more declared inside components,
 * none of them agreeing, so one run could read `Sep 13`, `Sat, Sep 13`,
 * `Sep 13, 2025` or `Sep 25` depending on which card it landed in - and the
 * `{month, year:'2-digit'}` fallback dropped the DAY, so a record set in March
 * 2023 rendered `Mar 23` and read as the 23rd of March.
 *
 * What replaces them: `formatDate` for a point in the past, `formatDateRange`
 * for a window, `formatCountdown` for a point in the future. The variation a
 * screen genuinely needs is an option SET, never a field order - the order is
 * the locale's to decide, and spelling out `day month` would invert the day it
 * NEXT_PUBLIC_LOCALE=fr. Every one of these hands Intl an option bag and lets
 * Intl place the fields.
 * ---------------------------------------------------------------------------
 */

export interface DateFormatOptions {
  /**
   * `day` (the default) names the day. `month` names the month alone, for a
   * fact whose day is unknown or beside the point - when a shoe was first worn,
   * the month a baseline is measured from.
   */
  precision?: 'day' | 'month'
  /**
   * `auto` (the default) prints the year only when the date falls outside
   * `now`'s: the archive spans years, so `Sat, Jun 27` on its own cannot say
   * which June it was. `never` is for a date already sitting under a year
   * heading, where the year would be said twice. `always` is for a multi-year
   * axis, where `auto` would put the year on some ticks and not others and the
   * ticks would stop being comparable.
   */
  year?: 'auto' | 'never' | 'always'
  /**
   * `short` (the default) is the app's date: short weekday, short month.
   * `bare` drops the weekday for chart ticks, table cells and dense captions,
   * where it only buys width. `full` spells the weekday and month out, so a
   * screen reader reading an aria-label does not have to guess at `Sat, Jun`.
   */
  style?: 'short' | 'bare' | 'full'
  /** Injectable for tests; the year rule is relative to this. */
  now?: Date
}

/**
 * Node's ICU and the browser's ICU do not agree on which space character to put
 * around a range dash: Node emits U+2009 THIN SPACE, Chrome emits U+0020. The
 * two render identically and compare unequal, so the same formatter call made on
 * the server and again on hydration tears the tree down. The same split shows up
 * around NBSP in other locales.
 *
 * Normalising every Unicode space separator to U+0020 makes the output depend on
 * the options we passed and nothing else. It keeps formatRange's real value - it
 * still collapses "Sep 3 - 6" to one month and adds the year only where asked -
 * without letting the ICU build decide the bytes.
 */
const UNICODE_SPACE_SEPARATORS = /[   -   　]/g

function stableSpaces(text: string): string {
  return text.replace(UNICODE_SPACE_SEPARATORS, ' ')
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

/**
 * The option set every chart axis wants, named once because ten files had it
 * typed out inline: a tick has about 40px, and the chart's own window label
 * already says which stretch of the year it covers.
 */
export const AXIS_TICK_DATE: DateFormatOptions = { style: 'bare', year: 'never' }

/** The one date. See DateFormatOptions for the knobs and why each one exists. */
export function formatDate(isoDate: string, options: DateFormatOptions = {}): string {
  const { year = 'auto', now = new Date() } = options
  const date = atMidnight(isoDate)
  const showYear =
    year === 'always' || (year === 'auto' && date.getFullYear() !== now.getFullYear())
  return stableSpaces(date.toLocaleDateString(t.locale, dateFields(options, showYear)))
}

/** "Thu", or "Thu 24" with the day: a list row under its week's heading. */
export function formatWeekday(isoDate: string, withDay = false): string {
  const date = atMidnight(isoDate.slice(0, 10))
  const weekday = date.toLocaleDateString(t.locale, { weekday: 'short' }).replace(/\.$/, '')
  return stableSpaces(withDay ? `${weekday} ${date.getDate()}` : weekday)
}

export function formatMonthShortYear(isoDate: string, options: DateFormatOptions = {}): string {
  const month = formatDate(isoDate, { ...options, precision: 'month', year: 'never' })
  return t.dates.monthShortYear(month, isoDate.slice(2, 4))
}

/**
 * A window's two bare months, each carrying its own apostrophe-year only when
 * that end's year differs from the other's - "May - Dec '25" for a range that
 * stays inside one year, "Oct '25 - Jul '26" for one that crosses into the
 * next. Built from `formatMonthShortYear` rather than `formatDateRange`
 * because a table header this narrow needs the same compact `'25` the rest of
 * the app already uses for a bare month, not `Intl`'s four-digit year.
 */
export function formatEraRange(startIso: string, endIso: string): string {
  const startMonth = formatDate(startIso, { precision: 'month', year: 'never' })
  const sameYear = startIso.slice(2, 4) === endIso.slice(2, 4)
  const start = sameYear ? startMonth : formatMonthShortYear(startIso)
  return `${start} - ${formatMonthShortYear(endIso)}`
}

/**
 * The one window. `Intl.formatRange` collapses whatever the two sides share, so
 * a week inside one month reads `Sep 7 - 13` rather than `Sep 7 - Sep 13`.
 *
 * A range never carries the weekday: formatRange repeats every field it is
 * given on both sides, and `Mon, Sep 8 - Sun, Sep 14` spends twelve extra
 * characters saying what `Sep 8 - 14` already says. The year appears when
 * EITHER end falls outside the current one, because a window that straddles new
 * year is exactly the case where one bare month is ambiguous.
 */
export function formatDateRange(startIso: string, endIso: string, options: DateFormatOptions = {}): string {
  const { year = 'auto', now = new Date() } = options
  const start = atMidnight(startIso)
  const end = atMidnight(endIso)
  const showYear =
    year === 'always' ||
    (year === 'auto' &&
      (start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear()))
  return stableSpaces(
    new Intl.DateTimeFormat(t.locale, dateFields(options, showYear, true)).formatRange(start, end)
  )
}

/**
 * The one future date, and it is not a date: a race four days out is `D-4`, not
 * `4 days` in one card and `4d` in the next. The two ends of the count read as
 * words because `D-0` is a thing nobody says out loud on race morning.
 */
export function formatCountdown(days: number): string {
  const remaining = Math.max(0, Math.round(days))
  const r = t.nextRace
  return remaining === 0 ? r.today : remaining === 1 ? r.tomorrow : r.countdown(remaining)
}

/**
 * Not a fourth date format - the abbreviated month for anything that buckets by
 * calendar month and holds a month number rather than a date. Goes through
 * formatDate so it cannot drift away from `{ precision: 'month' }`, which is
 * also what keeps a locale from spelling the same month two ways on adjacent
 * cards.
 */
export function monthName(month: number): string {
  const iso = `2000-${String(month).padStart(2, '0')}-01`
  return formatDate(iso, { precision: 'month', year: 'never' })
}

/** monthName in the uppercase a chart axis wants. */
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

/**
 * formatDelta at a fixed precision, for a reading whose decimals are part of
 * it: a 5.0 % drift sits in a list of 4.6 % and 5.3 %, not as "5 %". Same sign
 * rules - a real minus, and a flat reading marked rather than blank.
 */
export function formatDeltaFixed(value: number, decimals: number, unit?: string): string {
  const rounded = Number(value.toFixed(decimals))
  const magnitude = formatKm(Math.abs(rounded), decimals)
  const body = rounded === 0 ? `${PLUS_MINUS}${magnitude}` : `${rounded > 0 ? '+' : MINUS}${magnitude}`
  return unit ? `${body} ${unit}` : body
}
