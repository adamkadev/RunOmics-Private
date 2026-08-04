import { t } from '@/i18n'

// Single letter avatar badge, matching the Dashboard greeting's style.
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

/** "1 h 40" / "48 min" - rounded to the minute, for compact time-in-zone readouts. */
export function formatDurationWords(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}${t.units.hour}${String(m).padStart(2, '0')}` : `${m} ${t.units.min}`
}

export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}`
  }

  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formats a number of seconds as `m:ss` (rounds to the nearest second). */
export function formatClock(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formats sec/km as `5:48 /km` - unit included, never append one at the call site. */
export function formatPace(secPerKm: number): string {
  return `${formatClock(secPerKm)} /km`
}

/** Formats a [fast, slow] sec/km pair as `3:42-3:48 /km`. */
export function formatPaceRange([fast, slow]: [number, number]): string {
  return `${formatClock(fast)}-${formatClock(slow)} /km`
}

export function formatDistance(km: number): string {
  return `${km.toFixed(km >= 10 ? 1 : 2)}`
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Date with year, for contexts spanning multiple years (e.g. `Mar 28, 2025`). */
export function formatDateWithYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Full weekday + day + month, e.g. `Tuesday 20 June` - used for the selected day header. */
export function formatDateFull(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Short day + month, e.g. `Jun 16` - used for the agenda week-range subtitle. */
export function formatDayMonth(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    day: 'numeric',
  })
}

/** Compact date for tight spaces: `Jun 16` in the current year, `Jan '25` otherwise. */
export function formatCompactDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const currentYear = new Date().getFullYear()
  return d.toLocaleDateString(t.locale, d.getFullYear() === currentYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', year: '2-digit' }
  )
}

/** Short month + full year, e.g. `Oct 2025` / `mars 2026`. One format that
 *  reads the same whatever the year - unlike formatCompactDate, which drops the
 *  year for the current year. For dates that span years, like a shoe's first
 *  outing, so every shoe shows the same shape. */
export function formatCompactMonthYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    year: 'numeric',
  })
}

/** Month + year, e.g. `August 2025` - for spans where the exact day is noise. */
export function formatMonthYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'long',
    year: 'numeric',
  })
}

/** Three-letter uppercase month label from a 1-based month number (1 = JAN). */
export function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString(t.locale, { month: 'short' }).toUpperCase()
}

/**
 * "Jul 6 - 12" (or "Jun 29 - Jul 5" across a month boundary), for a Monday-
 * Sunday week group header. `formatRange` picks the locale's own order and
 * elision, so fr reads "6-12 juil." rather than the month-first "juil. 6 - 12"
 * that hand-assembling the parts produced.
 */
export function weekRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  return new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' }).formatRange(start, end)
}

export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days'

/** Buckets the elapsed time since an ISO timestamp into a unit + value, for i18n display. */
export function relativeTimeParts(iso: string, now: Date = new Date()): { unit: RelativeTimeUnit; value: number } {
  const diffMinutes = Math.floor(Math.max(0, now.getTime() - new Date(iso).getTime()) / 60_000)
  if (diffMinutes < 1) return { unit: 'now', value: 0 }
  if (diffMinutes < 60) return { unit: 'minutes', value: diffMinutes }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return { unit: 'hours', value: diffHours }
  return { unit: 'days', value: Math.floor(diffHours / 24) }
}

/** "2h ago" / "il y a 2 h" - shared by the Today hero and the Settings data-source status. */
export function formatRelativeAgo(iso: string): string {
  const s = t.dashboard.syncStatus
  const { unit, value } = relativeTimeParts(iso)
  return unit === 'now' ? s.justNow :
    unit === 'minutes' ? s.minutesAgo(value) :
    unit === 'hours' ? s.hoursAgo(value) :
    s.daysAgo(value)
}

/** Parse a `m:ss` or `h:mm:ss` string into seconds. Returns null if invalid. */
export function parseTimeInput(str: string): number | null {
  const parts = str.trim().split(':').map(Number)
  const [a, b, c] = parts
  if (parts.length === 2 && a !== undefined && b !== undefined && !parts.some(isNaN)) return a * 60 + b
  if (parts.length === 3 && a !== undefined && b !== undefined && c !== undefined && !parts.some(isNaN)) return a * 3600 + b * 60 + c
  return null
}
