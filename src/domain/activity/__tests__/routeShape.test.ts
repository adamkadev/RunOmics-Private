import { describe, it, expect } from 'vitest'
import { overlap, routeCells, routeOutline, type Coord } from '../routeShape'

describe('routeCells', () => {
  it('collapses points within the same ~110 m tile', () => {
    expect(routeCells([[6.1000, 49.6000], [6.10002, 49.60003]])).toEqual(new Set(['49600:6100']))
  })

  it('separates points a tile apart', () => {
    expect(routeCells([[6.1, 49.6], [6.1, 49.602]]).size).toBe(2)
  })
})

describe('overlap', () => {
  it('is 1 when the smaller trace is fully covered', () => {
    expect(overlap(new Set(['a', 'b']), new Set(['a', 'b', 'c', 'd']))).toBe(1)
  })

  it('measures against the smaller trace, whichever side it is passed on', () => {
    const short = new Set(['a', 'b'])
    const long = new Set(['a', 'c', 'd', 'e'])

    expect(overlap(short, long)).toBe(0.5)
    expect(overlap(long, short)).toBe(0.5)
  })

  it('is 0 for disjoint traces and for an empty one', () => {
    expect(overlap(new Set(['a']), new Set(['b']))).toBe(0)
    expect(overlap(new Set(), new Set(['a']))).toBe(0)
  })
})

describe('routeOutline', () => {
  const square: Coord[] = [[0, 50], [0.001, 50], [0.001, 50.001], [0, 50.001], [0, 50]]

  it('starts with a move and continues with lines', () => {
    const path = routeOutline(square)

    expect(path.startsWith('M')).toBe(true)
    expect(path.split('L').length).toBeGreaterThan(1)
  })

  it('keeps every coordinate inside the box', () => {
    const numbers = routeOutline(square, 100)
      .split(/[ML ]+/)
      .filter(Boolean)
      .map(Number)

    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100)
  })

  it('puts north at the top', () => {
    const northSouth: Coord[] = [[0, 50], [0, 50.002]]
    const [, startY, , endY] = routeOutline(northSouth).split(/[ML ]+/).filter(Boolean).map(Number)

    expect(startY!).toBeGreaterThan(endY!)
  })

  it('caps the number of plotted points', () => {
    const long: Coord[] = Array.from({ length: 1000 }, (_, i) => [i * 0.0001, 50 + i * 0.0001])

    expect(routeOutline(long, 100, 48).split(/[ML]/).length - 1).toBeLessThanOrEqual(48 + 1)
  })

  it('returns nothing when there is no shape to draw', () => {
    expect(routeOutline([[0, 50]])).toBe('')
    expect(routeOutline([[0, 50], [0, 50]])).toBe('')
  })
})
