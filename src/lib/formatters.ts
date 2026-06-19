export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  return `${km.toFixed(km >= 10 ? 1 : 2)} km`
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Date with year, for contexts spanning multiple years (e.g. `Mar 28, 2025`). */
export function formatDateWithYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Three-letter uppercase month label from a 1-based month number (1 = JAN). */
export function monthLabel(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' }).toUpperCase()
}

/** Parse a `m:ss` or `h:mm:ss` string into seconds. Returns null if invalid. */
export function parseTimeInput(str: string): number | null {
  const parts = str.trim().split(':').map(Number)
  if (parts.length === 2 && !parts.some(isNaN)) return parts[0] * 60 + parts[1]
  if (parts.length === 3 && !parts.some(isNaN)) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}
