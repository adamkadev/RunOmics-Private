export interface ZoneEntry<T> {
  zone: number
  used: boolean
  data: T
}

export type ZoneListItem<T> =
  | { kind: 'zone'; zone: number; data: T }
  | { kind: 'unused'; zones: number[] }

export function collapseUnusedZones<T>(entries: ZoneEntry<T>[]): ZoneListItem<T>[] {
  if (!entries.some((entry) => entry.used)) {
    return entries.map((entry) => ({ kind: 'zone', zone: entry.zone, data: entry.data }))
  }

  const items: ZoneListItem<T>[] = []
  let run: number[] = []

  const flush = () => {
    if (run.length > 0) {
      items.push({ kind: 'unused', zones: run })
      run = []
    }
  }

  for (const entry of entries) {
    if (entry.used) {
      flush()
      items.push({ kind: 'zone', zone: entry.zone, data: entry.data })
    } else {
      run.push(entry.zone)
    }
  }
  flush()

  return items
}

export function zoneRangeLabel(zones: number[]): string {
  if (zones.length === 0) return ''

  const ordered = [...zones].sort((a, b) => a - b)
  const first = ordered[0]!
  const last = ordered[ordered.length - 1]!

  return first === last ? `Z${first}` : `Z${first}–Z${last}`
}
