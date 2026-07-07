import { describe, it, expect } from 'vitest'
import type { RouteMeta } from '@/application/usecases/GetAllRoutes'
import { ROUTE_GRID } from '@/lib/routeMatch'
import { buildPersonalSegment } from '../personalSegment'

function line(steps: number, latOffsetCells = 0): [number, number][] {
  return Array.from({ length: steps }, (_, i) => [6.17 + i * ROUTE_GRID, 49.12 + latOffsetCells * ROUTE_GRID])
}

function meta(id: string, date: string, paceSecPerKm: number | null, distanceKm = 8): RouteMeta {
  return { id, type: 'Base', year: date.slice(0, 4), date, distanceKm, durationSeconds: 2400, paceSecPerKm }
}

const today = new Date().toISOString().slice(0, 10)

describe('buildPersonalSegment', () => {
  const routes = [line(200), line(200, 1), line(200), line(200, 10)]
  const routeMeta = [
    meta('a', '2026-01-10', 250),
    meta('b', '2026-03-02', 240),
    meta('c', today, 245),
    meta('d', '2026-05-01', 230), // parallel street, not the same segment
  ]

  it('groups repeated passes of the same trace and ranks them by pace', () => {
    const segment = buildPersonalSegment(2, [0, 1, 2, 3], routes, routeMeta)
    expect(segment).not.toBeNull()
    expect(segment!.passes).toBe(3)
    expect(segment!.bestPaceSecPerKm).toBe(240)
    expect(segment!.entries.map((e) => e.rank)).toEqual([1, 2, 3])
    expect(segment!.entries.find((e) => e.isSelected)?.activityId).toBe('c')
  })

  it('computes the 90-day trend against older passes', () => {
    const segment = buildPersonalSegment(2, [0, 1, 2], routes, routeMeta)
    // recent = today's 245; older = (250 + 240) / 2 = 245 -> flat
    expect(segment!.trendDeltaSecPerKm).toBe(0)
  })

  it('returns null below 3 passes', () => {
    expect(buildPersonalSegment(2, [1, 2], routes, routeMeta)).toBeNull()
  })

  it('keeps the tapped run in the podium even when slower than 3 others', () => {
    const manyRoutes = [line(200), line(200), line(200), line(200)]
    const manyMeta = [
      meta('r1', '2026-01-01', 200),
      meta('r2', '2026-02-01', 210),
      meta('r3', '2026-03-01', 220),
      meta('r4', '2026-04-01', 260),
    ]
    const segment = buildPersonalSegment(3, [0, 1, 2, 3], manyRoutes, manyMeta)
    expect(segment!.entries.some((e) => e.activityId === 'r4' && e.isSelected && e.rank === 4)).toBe(true)
  })

  it('returns null when the tapped route has no pace', () => {
    const noPace = [meta('a', '2026-01-10', null), routeMeta[1]!, routeMeta[2]!]
    expect(buildPersonalSegment(0, [0, 1, 2], routes, noPace)).toBeNull()
  })
})
