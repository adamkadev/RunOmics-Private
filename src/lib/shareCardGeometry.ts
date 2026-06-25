function projectRoute(route: [number, number][]): { x: number; y: number }[] {
  const avgLat = route.reduce((s, [, lat]) => s + lat, 0) / route.length
  const cos = Math.cos((avgLat * Math.PI) / 180)
  return route.map(([lng, lat]) => ({ x: lng * cos, y: -lat }))
}

/**
 * Projects raw GPS route points onto a `scaleRadius`-wide square centered at (cx, cy),
 * preserving aspect ratio. Pure geometry (no canvas/DOM dependency) so it's shared by
 * the canvas export (shareCardDraw.ts) and the HTML/SVG preview (ShareCardDesignPreview.tsx).
 */
export function projectRouteToCircle(route: [number, number][], cx: number, cy: number, scaleRadius: number): { x: number; y: number }[] {
  const pts = projectRoute(route)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const scale = scaleRadius / span
  const ox = cx - ((minX + maxX) / 2) * scale
  const oy = cy - ((minY + maxY) / 2) * scale
  return pts.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy }))
}

export function routePathD(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}
