import { describe, it, expect } from 'vitest'
import { clusterByRoute, farthestPoint } from '../GetRecurringRoutes'
import type { Activity } from '@/domain/activity/types'

const trace = (cells: number, lane = 0) =>
  Array.from({ length: cells }, (_, i): [number, number] => [6.1 + i * 0.001, 49.6 + lane * 0.001])

const run = (route: [number, number][], distanceKm: number, id = 'a'): Activity =>
  ({ id, date: '2026-07-20T08:00:00', route, distanceKm, paceSecPerKm: 300 }) as Activity

describe('clusterByRoute', () => {
  it('groups two runs over the same ground', () => {
    const clusters = clusterByRoute([run(trace(20), 10, 'a'), run(trace(20), 10, 'b')])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.runs.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('separates runs on different ground', () => {
    expect(clusterByRoute([run(trace(20), 10, 'a'), run(trace(20, 50), 10, 'b')])).toHaveLength(2)
  })

  it('keeps a run that covers the same ground plus an extra loop', () => {
    expect(clusterByRoute([run(trace(20), 10, 'a'), run(trace(22), 11, 'b')])).toHaveLength(1)
  })

  it('splits when the distance drifts too far, however much ground is shared', () => {
    expect(clusterByRoute([run(trace(20), 10, 'a'), run(trace(40), 20, 'b')])).toHaveLength(2)
  })

  it('splits when the traces only partly coincide', () => {
    const half = [...trace(10), ...trace(10, 50)] as [number, number][]

    expect(clusterByRoute([run(trace(20), 10, 'a'), run(half, 10, 'b')])).toHaveLength(2)
  })

  it('measures each run against the cluster it opened, not the previous run', () => {
    const clusters = clusterByRoute([
      run(trace(20), 10, 'a'),
      run(trace(20), 10, 'b'),
      run(trace(20), 10, 'c'),
    ])

    expect(clusters[0]?.runs).toHaveLength(3)
  })
})

describe('farthestPoint', () => {
  it('finds the turnaround of an out-and-back', () => {
    const out: [number, number][] = [[6.1, 49.6], [6.11, 49.6], [6.12, 49.6], [6.11, 49.6], [6.1, 49.6]]
    expect(farthestPoint(out)).toEqual([6.12, 49.6])
  })

  it('counts east-west and north-south alike', () => {
    // At 49.6°N a degree of longitude is about two thirds of a degree of
    // latitude, so the shorter-looking northward leg is the farther one.
    const loop: [number, number][] = [[6.1, 49.6], [6.113, 49.6], [6.1, 49.61]]
    expect(farthestPoint(loop)).toEqual([6.1, 49.61])
  })

  it('has nothing to name without a route', () => {
    expect(farthestPoint([])).toBeNull()
  })
})
