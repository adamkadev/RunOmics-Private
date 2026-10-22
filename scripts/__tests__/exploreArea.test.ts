import { createHash } from 'node:crypto'
import type { Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { EXPLORE_SCHEMA, type ExploreSource } from '@/domain/explore/types'
import {
  areaRef,
  areaVersion,
  buildAreaFile,
  cityUnitId,
  communeUnitId,
  irisUnitId,
  osmUnitId,
  serializeArea,
  slugify,
  upsertIndex,
  type AreaInput,
  type UnitInput,
} from '../explore/area'
import { citySource, displayName } from '../explore/cities'

const square = (lon: number, lat: number, size: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]],
})

const sources: ExploreSource[] = [
  { id: 'osm-runnable', label: '© OpenStreetMap contributors – runnable ways', licence: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright', version: '2026-10-22' },
]

const units: UnitInput[] = [
  { id: communeUnitId('99002'), name: 'Zéphyr-sur-Mer', kind: 'commune', commune: 'Zéphyr-sur-Mer', label: [20.025, 5.005], runnable: [9, 3], geometry: square(20.02, 5, 0.01) },
  { id: cityUnitId('ville', '2'), name: 'Les Îles', kind: 'quartier', commune: 'Ville', label: [20.015, 5.005], runnable: [7, 5], geometry: square(20.01, 5, 0.01) },
  { id: cityUnitId('ville', '1'), name: 'Centre', kind: 'quartier', commune: 'Ville', label: [20.005, 5.005], runnable: [1, 2], geometry: square(20, 5, 0.01) },
  { id: communeUnitId('99001'), name: 'Arbre', kind: 'commune', commune: 'Arbre', label: [20.005, 4.995], runnable: [], geometry: square(20, 4.99, 0.01) },
]

const input: AreaInput = { id: 'ville', name: 'Ville', generatedAt: '2026-10-22', grid: { origin: [20.0123456789, 5.00987654321], cellM: 150 }, sources, units }

describe('unit ids', () => {
  it('are built from the sources’ own stable ids', () => {
    expect(cityUnitId('metz', '5746332')).toBe('metz-5746332')
    expect(communeUnitId('57049')).toBe('insee-57049')
    expect(irisUnitId('574630101')).toBe('iris-574630101')
    expect(osmUnitId(123)).toBe('osm-r123')
  })

  it('slug the city name into the area id', () => {
    expect(slugify('Metz')).toBe('metz')
    expect(slugify('Le Ban-Saint-Martin')).toBe('le-ban-saint-martin')
    expect(slugify("Saint-Étienne-du-Rouvray  (l'Île)")).toBe('saint-etienne-du-rouvray-l-ile')
  })
})

describe('buildAreaFile', () => {
  const file = buildAreaFile(input)

  it('is a GeoJSON FeatureCollection with the runomics member', () => {
    expect(file.type).toBe('FeatureCollection')
    expect(file.runomics).toMatchObject({ schema: EXPLORE_SCHEMA, id: 'ville', name: 'Ville', generatedAt: '2026-10-22', sources })
    expect(file.runomics.grid).toEqual({ origin: [20.012346, 5.009877], cellM: 150 })
    expect(file.runomics.bbox).toEqual([20, 4.99, 20.03, 5.01])
  })

  it('lists the city’s quartiers first, then the communes, each by name', () => {
    expect(file.features.map((feature) => feature.properties.name)).toEqual(['Centre', 'Les Îles', 'Arbre', 'Zéphyr-sur-Mer'])
  })

  it('gives each feature its id twice and its runnable cells sorted', () => {
    for (const feature of file.features) {
      expect(feature.type).toBe('Feature')
      expect(feature.id).toBe(feature.properties.id)
      expect(Object.keys(feature.properties)).toEqual(['id', 'name', 'kind', 'commune', 'label', 'runnable'])
    }
    expect(file.features[1]!.properties.runnable).toEqual([5, 7])
  })

  it('refuses two units with one id', () => {
    expect(() => buildAreaFile({ ...input, units: [...units, units[0]!] })).toThrow(/share the id/)
  })
})

describe('the version', () => {
  const file = buildAreaFile(input)

  it('is the id, the build date and a hash of the content', () => {
    expect(file.runomics.version).toMatch(/^ville-20261022-[0-9a-f]{8}$/)
    const unversioned = JSON.stringify({ ...file, runomics: { ...file.runomics, version: '' } })
    expect(file.runomics.version.slice(-8)).toBe(createHash('sha256').update(unversioned).digest('hex').slice(0, 8))
    expect(areaVersion(file)).toBe(file.runomics.version)
  })

  it('does not depend on the order the units came in', () => {
    const shuffled = buildAreaFile({ ...input, units: [...units].reverse() })
    expect(shuffled.runomics.version).toBe(file.runomics.version)
    expect(serializeArea(shuffled)).toBe(serializeArea(file))
  })

  it('changes with any cell', () => {
    const changed = buildAreaFile({ ...input, units: units.map((unit, i) => (i === 0 ? { ...unit, runnable: [3, 9, 11] } : unit)) })
    expect(changed.runomics.version).not.toBe(file.runomics.version)
  })
})

describe('upsertIndex', () => {
  const file = buildAreaFile(input)

  it('starts an index', () => {
    expect(upsertIndex(null, areaRef(file))).toEqual({
      schema: EXPLORE_SCHEMA,
      areas: [{ id: 'ville', name: 'Ville', version: file.runomics.version, bbox: file.runomics.bbox, file: 'ville.geojson' }],
    })
  })

  it('replaces the area’s own row and keeps the others', () => {
    const other = { id: 'autre', name: 'Autre', version: 'autre-20260101-00000000', bbox: [1, 2, 3, 4] as [number, number, number, number], file: 'autre.geojson' }
    const stale = { ...areaRef(file), version: 'ville-20250101-ffffffff' }
    const index = upsertIndex({ schema: EXPLORE_SCHEMA, areas: [stale, other] }, areaRef(file))
    expect(index.areas.map((area) => [area.id, area.version])).toEqual([
      ['autre', 'autre-20260101-00000000'],
      ['ville', file.runomics.version],
    ])
  })
})

describe('the city registry', () => {
  it('cleans the published names of Metz’s quartiers', () => {
    const metz = citySource('57463')!
    expect(displayName(metz, 'Les Iles')).toBe('Les Îles')
    expect(displayName(metz, 'Metz-centre')).toBe('Metz-Centre')
    expect(displayName(metz, 'Sablon')).toBe('Sablon')
    expect(citySource('00000')).toBeUndefined()
  })
})
