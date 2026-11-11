import { distanceKm } from '@/lib/math'

export type LngLat = readonly [number, number]

export interface HomeSpot {
  center: [number, number]
  /** Indices into the starts passed in. */
  members: number[]
}

/** Runs started within `radiusM` of a spot's centre belong to it; spots with fewer than `minRuns` are left out. */
export function homeSpots(starts: readonly (LngLat | null)[], radiusM: number, minRuns: number): HomeSpot[] {
  const radiusKm = radiusM / 1000
  const left = new Set<number>()
  starts.forEach((s, i) => {
    if (s && Number.isFinite(s[0]) && Number.isFinite(s[1])) left.add(i)
  })
  const spots: HomeSpot[] = []
  while (left.size >= minRuns) {
    let best = -1
    let bestNear: number[] = []
    for (const i of left) {
      const [lon, lat] = starts[i]!
      const near = [...left].filter((j) => distanceKm(lon, lat, starts[j]![0], starts[j]![1]) <= radiusKm)
      if (near.length > bestNear.length) {
        best = i
        bestNear = near
      }
    }
    if (best < 0 || bestNear.length < minRuns) break
    const lons = bestNear.map((j) => starts[j]![0]).sort((a, b) => a - b)
    const lats = bestNear.map((j) => starts[j]![1]).sort((a, b) => a - b)
    const center: [number, number] = [lons[lons.length >> 1]!, lats[lats.length >> 1]!]
    const members = [...left].filter((j) => distanceKm(center[0], center[1], starts[j]![0], starts[j]![1]) <= radiusKm)
    spots.push({ center, members })
    for (const j of members) left.delete(j)
  }
  return spots
}

export function cumulativeMetres(route: readonly LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < route.length; i++) {
    const [lon1, lat1] = route[i - 1]!
    const [lon2, lat2] = route[i]!
    out.push(out[i - 1]! + distanceKm(lon1, lat1, lon2, lat2) * 1000)
  }
  return out
}

/** Seconds into the run at each point; the samples are taken as evenly spaced in time, as the sync decimates them. */
export function pointSeconds(route: readonly LngLat[], paceSamples: readonly number[] | null, durationSeconds: number): number[] {
  const metres = cumulativeMetres(route)
  const total = metres[metres.length - 1] ?? 0
  if (route.length < 2 || total <= 0) return route.map(() => 0)
  const paces = (paceSamples ?? []).filter((p) => Number.isFinite(p) && p > 0)
  if (paces.length < 2) return metres.map((m) => (m / total) * durationSeconds)

  // Distance share covered by the end of each sample's slice, from speed = 1 / pace.
  const shares = [0]
  for (const pace of paces) shares.push(shares[shares.length - 1]! + 1 / pace)
  const covered = shares[shares.length - 1]!
  const slices = paces.length

  const out: number[] = []
  let k = 0
  for (const m of metres) {
    const target = (m / total) * covered
    while (k < slices - 1 && shares[k + 1]! < target) k++
    const span = shares[k + 1]! - shares[k]!
    const within = span > 0 ? Math.min(1, Math.max(0, (target - shares[k]!) / span)) : 0
    out.push(((k + within) / slices) * durationSeconds)
  }
  return out
}

/** Every `step`-th point and the last, until no more than `maxPoints` remain. */
export function thinIndices(length: number, maxPoints: number): number[] {
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i)
  const step = Math.ceil((length - 1) / (maxPoints - 1))
  const out: number[] = []
  for (let i = 0; i < length - 1; i += step) out.push(i)
  out.push(length - 1)
  return out
}

/** Run seconds at share `u` of the replay: slow at first so the crowded start reads, then faster so long runs don't drag. */
export function warpSeconds(u: number, maxSeconds: number, k = 3): number {
  const x = Math.min(1, Math.max(0, u))
  return (maxSeconds * (Math.exp(k * x) - 1)) / (Math.exp(k) - 1)
}

/** The last point reached by `seconds`, and how far towards the next one. */
export function headAt(times: readonly number[], seconds: number): { index: number; within: number } {
  if (times.length === 0) return { index: -1, within: 0 }
  if (seconds < times[0]!) return { index: -1, within: 0 }
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid]! <= seconds) lo = mid
    else hi = mid - 1
  }
  if (lo === times.length - 1) return { index: lo, within: 0 }
  const span = times[lo + 1]! - times[lo]!
  return { index: lo, within: span > 0 ? (seconds - times[lo]!) / span : 0 }
}

/** Runs finished by `seconds`, counted per `binSeconds` of finish time, over `binCount` bins; the last bin takes the rest. */
export function finishBins(durations: readonly number[], seconds: number, binSeconds: number, binCount: number): number[] {
  const bins = new Array<number>(binCount).fill(0)
  for (const d of durations) {
    if (d > seconds) continue
    bins[Math.min(binCount - 1, Math.floor(d / binSeconds))]!++
  }
  return bins
}
