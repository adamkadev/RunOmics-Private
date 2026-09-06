export type Coord = [number, number]

export const CELL_DEGREES = 0.001

export function routeCells(route: Coord[], cellSize = CELL_DEGREES): Set<string> {
  return new Set(route.map(([lon, lat]) => `${Math.round(lat / cellSize)}:${Math.round(lon / cellSize)}`))
}

export function overlap(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  if (small.size === 0) return 0

  let shared = 0
  for (const cell of small) if (large.has(cell)) shared++
  return shared / small.size
}

export function routeOutline(route: Coord[], size = 100, maxPoints = 48): string {
  if (route.length < 2) return ''

  const step = Math.max(1, Math.ceil(route.length / maxPoints))
  const sampled = route.filter((_, i) => i % step === 0)
  if (sampled[sampled.length - 1] !== route[route.length - 1]) sampled.push(route[route.length - 1]!)

  const lons = sampled.map(([lon]) => lon)
  const lats = sampled.map(([, lat]) => lat)
  const minLon = Math.min(...lons)
  const minLat = Math.min(...lats)
  const lonScale = Math.cos((minLat * Math.PI) / 180)
  const width = (Math.max(...lons) - minLon) * lonScale
  const height = Math.max(...lats) - minLat
  const span = Math.max(width, height)
  if (span === 0) return ''

  const scale = size / span
  const offsetX = (size - width * scale) / 2
  const offsetY = (size - height * scale) / 2

  return sampled
    .map(([lon, lat], i) => {
      const x = offsetX + (lon - minLon) * lonScale * scale
      const y = size - offsetY - (lat - minLat) * scale
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}
