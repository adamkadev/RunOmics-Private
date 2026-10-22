import { describe, it, expect } from 'vitest'
import { flattenRoute, flattenTracks, isValidTrackBuffers, selectTracks } from '../trackBuffers'

/** Fictional mid-Pacific points: nowhere anyone runs. */
const A: [number, number][] = [
  [-150, 45],
  [-150.001, 45.001],
  [-150.002, 45.002],
]
const B: [number, number][] = [[-149.5, 44.5]]
const C: [number, number][] = [
  [-149, 44],
  [-149.001, 44],
]

const meta = [
  { id: 'a', date: '2026-10-01T07:00:00Z' },
  { id: 'b', date: '2026-09-15' },
  { id: 'c', date: '2026-08-02' },
  { id: 'd', date: '2026-07-20' },
]

describe('flattenTracks', () => {
  it('packs the chosen routes one after the other, with point offsets', () => {
    const tracks = flattenTracks([A, B, C], [0, 2], meta)

    expect(tracks.ids).toEqual(['a', 'c'])
    expect(tracks.dates).toEqual(['2026-10-01', '2026-08-02'])
    expect(Array.from(tracks.offsets)).toEqual([0, 3, 5])
    expect(Array.from(tracks.coords)).toEqual([...A.flat(), ...C.flat()])
    expect(isValidTrackBuffers(tracks)).toBe(true)
  })

  it('skips missing and empty routes, routes without meta and repeated ids', () => {
    const routes = [A, undefined, [], B]
    const tracks = flattenTracks(routes, [0, 1, 2, 3, 0, 9], [...meta.slice(0, 3), meta[0]!])

    // index 3 carries id 'a' again; index 9 has neither route nor meta.
    expect(tracks.ids).toEqual(['a'])
    expect(Array.from(tracks.offsets)).toEqual([0, 3])
  })

  it('drops points that are not numbers, and a route left with none', () => {
    const broken = [[-150, 45], [Number.NaN, 45], [-150.001, 45.001]] as [number, number][]
    const allBroken = [[Number.NaN, 1]] as [number, number][]
    const tracks = flattenTracks([broken, allBroken], [0, 1], meta)

    expect(tracks.ids).toEqual(['a'])
    expect(Array.from(tracks.coords)).toEqual([-150, 45, -150.001, 45.001])
  })

  it('gives empty buffers for nothing', () => {
    const tracks = flattenTracks([], [], [])

    expect(tracks.ids).toEqual([])
    expect(Array.from(tracks.offsets)).toEqual([0])
    expect(tracks.coords).toHaveLength(0)
    expect(isValidTrackBuffers(tracks)).toBe(true)
  })
})

describe('selectTracks', () => {
  it('copies the chosen tracks into new buffers, leaving the originals alone', () => {
    const all = flattenTracks([A, B, C], [0, 1, 2], meta)
    const picked = selectTracks(all, [2, 0])

    expect(picked.ids).toEqual(['c', 'a'])
    expect(picked.dates).toEqual(['2026-08-02', '2026-10-01'])
    expect(Array.from(picked.offsets)).toEqual([0, 2, 5])
    expect(Array.from(picked.coords)).toEqual([...C.flat(), ...A.flat()])
    expect(picked.coords.buffer).not.toBe(all.coords.buffer)
    expect(all.coords).toHaveLength(12)
  })
})

describe('flattenRoute', () => {
  it('flattens a JSON route and ignores anything else', () => {
    expect(Array.from(flattenRoute(A))).toEqual(A.flat())
    expect(Array.from(flattenRoute([[1, 2], 'x', [3], [4, 5]]))).toEqual([1, 2, 4, 5])
    expect(flattenRoute(undefined)).toHaveLength(0)
    expect(flattenRoute({ 0: [1, 2] })).toHaveLength(0)
  })
})

describe('isValidTrackBuffers', () => {
  const good = () => flattenTracks([A, C], [0, 1], meta)

  it.each([
    ['offsets of the wrong length', { offsets: new Uint32Array([0, 3]) }],
    ['offsets that do not start at 0', { offsets: new Uint32Array([1, 3, 5]) }],
    ['offsets that go backwards', { offsets: new Uint32Array([0, 4, 3]) }],
    ['offsets past the coordinates', { offsets: new Uint32Array([0, 3, 6]) }],
    ['dates that do not match the ids', { dates: ['2026-10-01'] }],
    ['an empty id', { ids: ['a', ''] }],
    ['plain arrays instead of typed ones', { coords: [1, 2] as unknown as Float64Array }],
  ])('rejects %s', (_, change) => {
    expect(isValidTrackBuffers({ ...good(), ...change })).toBe(false)
  })
})
