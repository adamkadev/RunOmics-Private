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

export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}`
  }

  return `${m}:${String(s).padStart(2, '0')}`
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

/**
 * The one shape every delta in the app takes: sign, value, unit. A real minus
 * rather than a hyphen, because a hyphen at 10px next to a digit reads as part
 * of the number.
 */
export function formatDelta(value: number, unit?: string): string {
  const rounded = Math.round(value * 100) / 100
  const sign = rounded > 0 ? '+' : rounded < 0 ? MINUS : ''
  const body = `${sign}${Math.abs(rounded)}`
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
  return `${km.toFixed(km >= 10 ? 1 : 2)}`
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateWithYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateFull(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatDayMonth(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatCompactDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  const currentYear = new Date().getFullYear()
  return d.toLocaleDateString(t.locale, d.getFullYear() === currentYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', year: '2-digit' }
  )
}

export function formatCompactMonthYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'short',
    year: 'numeric',
  })
}

export function formatMonthYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(t.locale, {
    month: 'long',
    year: 'numeric',
  })
}

export function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString(t.locale, { month: 'short' }).toUpperCase()
}

export function weekRangeLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  return new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' }).formatRange(start, end)
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
