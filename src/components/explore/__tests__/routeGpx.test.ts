import { describe, expect, it } from 'vitest'
import { GPX_MIME, routeGpxFile } from '../routeGpx'

describe('routeGpxFile', () => {
  const coordinates = [
    [-150, 45, 180],
    [-149.99, 45, 182.25],
    [-149.99, 45.01, 185],
    [-150, 45.0001, 181],
  ]

  it('is the loop alone, closed on its start, named for the quartier and its distance', async () => {
    const file = routeGpxFile({ unitName: 'Nouvelle Ville', coordinates, distanceM: 8140, time: '2026-10-22T07:30:00.000Z' })
    expect(file.name).toBe('RunOmics-NouvelleVille-8km.gpx')
    expect(file.type).toBe(GPX_MIME)
    const gpx = await file.text()
    expect(gpx).toContain('<name>RunOmics · Nouvelle Ville · 8.1 km</name>')
    expect(gpx).toContain('<time>2026-10-22T07:30:00.000Z</time>')
    const points = [...gpx.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)">/g)].map((m) => [m[2], m[1]])
    // Four points and the start again: the watch sees a loop, not a point-to-point course.
    expect(points).toHaveLength(5)
    expect(points[0]).toEqual(points.at(-1))
    expect(points[0]).toEqual(['-150.000000', '45.000000'])
    expect(gpx).toContain('<ele>182.3</ele>')
  })
})
