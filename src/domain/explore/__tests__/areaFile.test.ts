import { describe, it, expect } from 'vitest'
import { parseAreaFile, parseIndexFile } from '../areaFile'
import { testArea } from './areaFixture'

/** The fixture as it arrives over the network: plain JSON. */
function json(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(testArea())) as Record<string, unknown>
}

type Mutable = Record<string, unknown> & { runomics: Record<string, unknown>; features: Record<string, unknown>[] }

function mutated(change: (area: Mutable) => void): unknown {
  const area = json() as Mutable
  change(area)
  return area
}

const props = (area: Mutable, k = 0) => area.features[k]!.properties as Record<string, unknown>

describe('parseAreaFile', () => {
  it('accepts a well-formed area file as it is', () => {
    const area = json()

    expect(parseAreaFile(area)).toBe(area)
  })

  it('accepts a multipolygon unit', () => {
    const area = mutated((a) => {
      const geometry = a.features[0]!.geometry as { coordinates: unknown }
      a.features[0]!.geometry = { type: 'MultiPolygon', coordinates: [geometry.coordinates] }
    })

    expect(parseAreaFile(area)).not.toBeNull()
  })

  it.each([
    ['not an object', () => 'area'],
    ['null', () => null],
    ['another GeoJSON type', () => mutated((a) => (a.type = 'Feature'))],
    ['no runomics member', () => mutated((a) => delete (a as Record<string, unknown>).runomics)],
    ['another schema', () => mutated((a) => (a.runomics.schema = 2))],
    ['an id unfit for a URL', () => mutated((a) => (a.runomics.id = 'Metz/../x'))],
    ['an empty name', () => mutated((a) => (a.runomics.name = ' '))],
    ['no version', () => mutated((a) => delete a.runomics.version)],
    ['a version that is not a string', () => mutated((a) => (a.runomics.version = 3))],
    ['a zero cell size', () => mutated((a) => (a.runomics.grid = { origin: [0, 0], cellM: 0 }))],
    ['an origin that is not a number', () => mutated((a) => (a.runomics.grid = { origin: [Number.NaN, 0], cellM: 150 }))],
    ['an origin off the globe', () => mutated((a) => (a.runomics.grid = { origin: [200, 0], cellM: 150 }))],
    ['a bbox of three numbers', () => mutated((a) => (a.runomics.bbox = [0, 0, 1]))],
    ['sources that are not a list', () => mutated((a) => (a.runomics.sources = {}))],
    ['features that are not a list', () => mutated((a) => (a.features = {} as never))],
    ['a unit without an id', () => mutated((a) => delete props(a).id)],
    ['a feature id that differs from its unit id', () => mutated((a) => (a.features[0]!.id = 'other'))],
    ['a unit without a name', () => mutated((a) => (props(a).name = ''))],
    ['an unknown kind', () => mutated((a) => (props(a).kind = 'district'))],
    ['a label that is not a point', () => mutated((a) => (props(a).label = [1]))],
    ['a point geometry', () => mutated((a) => (a.features[0]!.geometry = { type: 'Point', coordinates: [0, 0] }))],
    ['a ring of three positions', () => mutated((a) => (a.features[0]!.geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] }))],
    ['a position that is not a number', () => mutated((a) => (a.features[0]!.geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 'x'], [1, 1], [0, 0]]] }))],
    ['unsorted runnable cells', () => mutated((a) => (props(a).runnable = [5, 3]))],
    ['repeated runnable cells', () => mutated((a) => (props(a).runnable = [3, 3]))],
    ['a negative runnable cell', () => mutated((a) => (props(a).runnable = [-1, 3]))],
    ['a fractional runnable cell', () => mutated((a) => (props(a).runnable = [1.5]))],
    ['a runnable cell beyond the grid', () => mutated((a) => (props(a).runnable = [2 ** 32]))],
    ['runnable cells that are not a list', () => mutated((a) => (props(a).runnable = '1,2'))],
    ['two units with one id', () => mutated((a) => {
      a.features[1]!.id = 'test-alpha'
      props(a, 1).id = 'test-alpha'
    })],
  ])('rejects %s', (_, make) => {
    expect(parseAreaFile(make())).toBeNull()
  })
})

describe('parseIndexFile', () => {
  const entry = { id: 'metz', name: 'Metz', version: 'metz-20261022-0123abcd', bbox: [6.1, 49.05, 6.25, 49.15], file: 'metz.geojson' }

  it('accepts a well-formed index', () => {
    const index = { schema: 1, areas: [entry, { ...entry, id: 'strasbourg', file: 'strasbourg.geojson' }] }

    expect(parseIndexFile(index)).toBe(index)
    expect(parseIndexFile({ schema: 1, areas: [] })).not.toBeNull()
  })

  it.each([
    ['another schema', { schema: 2, areas: [entry] }],
    ['no areas', { schema: 1 }],
    ['an id unfit for a URL', { schema: 1, areas: [{ ...entry, id: 'Metz' }] }],
    ['a file outside the folder', { schema: 1, areas: [{ ...entry, file: '../secrets.json' }] }],
    ['a hidden file', { schema: 1, areas: [{ ...entry, file: '.env' }] }],
    ['a bbox upside down', { schema: 1, areas: [{ ...entry, bbox: [6.25, 49.05, 6.1, 49.15] }] }],
    ['no version', { schema: 1, areas: [{ ...entry, version: '' }] }],
    ['two areas with one id', { schema: 1, areas: [entry, entry] }],
  ])('rejects %s', (_, index) => {
    expect(parseIndexFile(index)).toBeNull()
  })
})
