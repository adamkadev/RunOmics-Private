const M_PER_DEGREE = 111_320

type LonLat = [number, number]

/** Douglas–Peucker in metres about the track's own latitude: every point dropped lies within `toleranceM` of the line kept. */
export function simplifyTrack(points: readonly LonLat[], toleranceM: number): LonLat[] {
  if (points.length <= 2) return [...points]
  const kx = M_PER_DEGREE * Math.cos((points[0]![1] * Math.PI) / 180)
  const x = points.map((p) => p[0] * kx)
  const y = points.map((p) => p[1] * M_PER_DEGREE)
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const limit = toleranceM * toleranceM
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop()!
    const dx = x[to]! - x[from]!
    const dy = y[to]! - y[from]!
    const length2 = dx * dx + dy * dy
    let worst = -1
    let worstD2 = limit
    for (let i = from + 1; i < to; i++) {
      const px = x[i]! - x[from]!
      const py = y[i]! - y[from]!
      const t = length2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / length2)) : 0
      const ex = px - t * dx
      const ey = py - t * dy
      const d2 = ex * ex + ey * ey
      if (d2 > worstD2) {
        worstD2 = d2
        worst = i
      }
    }
    if (worst !== -1) {
      keep[worst] = 1
      stack.push([from, worst], [worst, to])
    }
  }
  return points.filter((_, i) => keep[i])
}
