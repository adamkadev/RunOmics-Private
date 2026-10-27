import type { TrackBuffers } from './workerProtocol'

// Points that are not two finite numbers are dropped on the way in, so a NaN never reaches the cell grid.

function isFinitePoint(point: unknown): point is [number, number] {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
}

function countPoints(route: readonly unknown[]): number {
  let n = 0
  for (const point of route) if (isFinitePoint(point)) n++
  return n
}

function copyPoints(route: readonly unknown[], into: Float64Array, at: number): number {
  let k = at
  for (const point of route) {
    if (!isFinitePoint(point)) continue
    into[2 * k] = point[0]
    into[2 * k + 1] = point[1]
    k++
  }
  return k
}

/** `routes` and `meta` are sparse, indexed by global route index. */
export function flattenTracks(
  routes: readonly ([number, number][] | undefined)[],
  indices: readonly number[],
  meta: readonly ({ id: string; date: string } | undefined)[],
): TrackBuffers {
  const picked: { route: [number, number][]; id: string; date: string; points: number }[] = []
  const seen = new Set<string>()
  let total = 0

  for (const i of indices) {
    const route = routes[i]
    const m = meta[i]
    if (!route || !m || seen.has(m.id)) continue
    const points = countPoints(route)
    if (points === 0) continue
    seen.add(m.id)
    picked.push({ route, id: m.id, date: m.date.slice(0, 10), points })
    total += points
  }

  const offsets = new Uint32Array(picked.length + 1)
  const coords = new Float64Array(2 * total)
  let at = 0
  picked.forEach((track, k) => {
    offsets[k] = at
    at = copyPoints(track.route, coords, at)
  })
  offsets[picked.length] = at

  return { ids: picked.map((t) => t.id), dates: picked.map((t) => t.date), offsets, coords }
}

/** Fresh buffers, so the caller's own are neither sent nor detached. */
export function selectTracks(tracks: TrackBuffers, keep: readonly number[]): TrackBuffers {
  let total = 0
  for (const k of keep) total += tracks.offsets[k + 1]! - tracks.offsets[k]!

  const offsets = new Uint32Array(keep.length + 1)
  const coords = new Float64Array(2 * total)
  let at = 0
  keep.forEach((k, n) => {
    const from = tracks.offsets[k]!
    const to = tracks.offsets[k + 1]!
    offsets[n] = at
    coords.set(tracks.coords.subarray(2 * from, 2 * to), 2 * at)
    at += to - from
  })
  offsets[keep.length] = at

  return { ids: keep.map((k) => tracks.ids[k]!), dates: keep.map((k) => tracks.dates[k]!), offsets, coords }
}

export function isValidTrackBuffers(tracks: TrackBuffers): boolean {
  const { ids, dates, offsets, coords } = tracks
  if (!Array.isArray(ids) || !Array.isArray(dates) || ids.length !== dates.length) return false
  if (!(offsets instanceof Uint32Array) || !(coords instanceof Float64Array)) return false
  if (offsets.length !== ids.length + 1 || offsets[0] !== 0) return false
  for (let k = 1; k < offsets.length; k++) if (offsets[k]! < offsets[k - 1]!) return false
  return 2 * offsets[ids.length]! <= coords.length && ids.every((id) => typeof id === 'string' && id.length > 0)
}
