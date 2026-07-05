import { t } from '@/i18n'

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
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

export function formatPace(secPerKm: number): string {
  return `${formatClock(secPerKm)} /km`
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

/** Three-letter uppercase month label from a 1-based month number (1 = JAN). */
export function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString(t.locale, { month: 'short' }).toUpperCase()
}

/** Full uppercase "MONTH YYYY" label for a date, used by a month group div. */
export function monthYearLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleString(t.locale, { month: 'long', year: 'numeric' }).toUpperCase()
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

/** Parse a `m:ss` or `h:mm:ss` string into seconds. Returns null if invalid. */
export function parseTimeInput(str: string): number | null {
  const parts = str.trim().split(':').map(Number)
  const [a, b, c] = parts
  if (parts.length === 2 && a !== undefined && b !== undefined && !parts.some(isNaN)) return a * 60 + b
  if (parts.length === 3 && a !== undefined && b !== undefined && c !== undefined && !parts.some(isNaN)) return a * 3600 + b * 60 + c
  return null
}
