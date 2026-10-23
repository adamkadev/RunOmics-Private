import { describe, expect, it } from 'vitest'
import { areaForPoint } from '@/domain/explore/areaForCluster'
import { parseAreaFile, parseIndexFile } from '@/domain/explore/areaFile'
import { activityCells, aggregateCoverage, buildAreaIndex } from '@/domain/explore/coverage'
import { geometryBBox, pointInGeometry } from '@/domain/explore/geometry'
import { cellCentre, cellIndices, cellKey, cellOf, projection } from '@/domain/explore/grid'
import { medianStart } from '@/domain/explore/home'
import type { ExploreAreaFile, UnitState } from '@/domain/explore/types'
import { buildAreaFile, type UnitInput } from '../explore/area'
import { DEMO_TOWN_GAPS, generateDemoDataset } from '../generate_demo_data.mjs'

// The demo generator is plain JavaScript and re-implements the grid; these checks hold it to the domain's.

type Dataset = Record<string, unknown>
interface Run {
  date: string
  route: [number, number][] | null
}

const NOW = new Date('2026-09-25T12:00:00Z')
const HOME_CENTRE: [number, number] = [-150, 0]
const AWAY_CENTRE: [number, number] = [-149, 3]

const dataset = (now: Date) => generateDemoDataset({ now }) as Dataset
const areaOf = (data: Dataset) => data['explore/demo.geojson'] as ExploreAreaFile
const runsOf = (data: Dataset): Run[] =>
  Object.entries(data)
    .filter(([key]) => /^activities\/\d{4}-\d{2}\.json$/.test(key))
    .flatMap(([, value]) => (value as { activities: Run[] }).activities)

const data = dataset(NOW)
const area = areaOf(data)

/** What every weekday's runs make of each unit. */
const EXPECTED: Record<string, UnitState> = {
  Eastgate: 'complete',
  Westbrook: 'complete',
  'Old Harbour': 'partly',
  Riverside: 'partly',
  Hillcrest: 'partly',
  Southfield: 'partly',
  Millbrook: 'fog',
}

function isGap(i: number, j: number): boolean {
  const [west, south, east, north] = DEMO_TOWN_GAPS.woods as [number, number, number, number]
  return i === DEMO_TOWN_GAPS.riverColumn || (i >= west && i < east && j >= south && j < north)
}

describe('demo Explore area', () => {
  it('ships an index and an area file that the app accepts', () => {
    const index = parseIndexFile(data['explore/index.json'])
    expect(parseAreaFile(area)).not.toBeNull()
    expect(index?.areas).toEqual([
      { id: 'demo', name: 'Fictional Bay', version: area.runomics.version, bbox: area.runomics.bbox, file: 'demo.geojson' },
    ])
  })

  it('is the file the build script would write for the same town', () => {
    const units: UnitInput[] = area.features.map(({ properties, geometry }) => ({ ...properties, geometry }))
    const { id, name, generatedAt, grid, sources } = area.runomics
    const built = buildAreaFile({ id, name, generatedAt, grid, sources, units })

    expect(built).toEqual(area)
    expect(built.runomics.version).toBe(area.runomics.version)
  })

  it('does not depend on the date it is generated on', () => {
    const later = dataset(new Date('2027-03-02T05:00:00Z'))
    expect(later['explore/index.json']).toEqual(data['explore/index.json'])
    expect(areaOf(later)).toEqual(area)
  })

  it('numbers its cells as the app’s grid does', () => {
    const p = projection(area.runomics.grid)
    for (const feature of area.features) {
      const { name, runnable } = feature.properties
      const others = area.features.filter((f) => f !== feature)
      for (const key of runnable) {
        const [lon, lat] = cellCentre(p, key)
        expect(pointInGeometry(lon, lat, feature.geometry), `${name} ${key}`).toBe(true)
        expect(others.some((f) => pointInGeometry(lon, lat, f.geometry)), `${name} ${key}`).toBe(false)
      }

      const [minLon, minLat, maxLon, maxLat] = geometryBBox(feature.geometry)
      const [i0, j0] = cellIndices(cellOf(p, minLon, minLat))
      const [i1, j1] = cellIndices(cellOf(p, maxLon, maxLat))
      const expected: number[] = []
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const [lon, lat] = cellCentre(p, cellKey(i, j))
          if (pointInGeometry(lon, lat, feature.geometry) && !isGap(i, j)) expected.push(cellKey(i, j))
        }
      }
      expect(runnable, name).toEqual(expected.sort((a, b) => a - b))
    }
  })

  it('is the home runs’ area, and not the away trip’s', () => {
    const refs = parseIndexFile(data['explore/index.json'])!.areas
    const home = medianStart(runsOf(data).flatMap((run) => (run.route?.[0] ? [run.route[0]] : [])))

    expect(areaForPoint(refs, HOME_CENTRE)?.id).toBe('demo')
    expect(areaForPoint(refs, home!)?.id).toBe('demo')
    expect(areaForPoint(refs, AWAY_CENTRE)).toBeNull()
  })

  // The routes depend on `now` only through its weekday, so seven days in a
  // row cover every dataset e2e can generate.
  it.each([0, 1, 2, 3, 4, 5, 6])('gives the runs complete, partly explored and fog units (day %i)', (day) => {
    const data = dataset(new Date(NOW.getTime() + day * 86_400_000))
    const index = buildAreaIndex(areaOf(data))
    const runs = runsOf(data).filter((run) => run.route?.length)
    const activities = runs.map((run, k) => ({ id: String(k), date: run.date, ...activityCells(index, run.route!.flat()) }))
    const home = medianStart(runs.filter((run) => run.route![0]![0] < -149.5).map((run) => run.route![0]!))

    const coverage = aggregateCoverage(index, activities, home)

    expect(Object.fromEntries(coverage.units.map((u) => [u.name, u.state]))).toEqual(EXPECTED)
    expect(coverage.completeCount).toBe(2)
    expect(coverage.unitCount).toBe(7)
    expect(coverage.nextId).toBe('demo-southfield')
  })
})
