import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { testArea } from '@/domain/explore/__tests__/areaFixture'
import type { AreaCoverage, UnitCoverage, UnitState } from '@/domain/explore/types'
import { accentColor } from '@/lib/accent'
import { heatAccent } from '@/lib/heatRamp'
import {
  DISTRICTS_CHECK_IMAGE,
  DISTRICTS_FILL_LAYER,
  DISTRICTS_LABEL_LAYER,
  DISTRICTS_COMPLETE_LABEL_LAYER,
  DISTRICTS_NEXT_LABEL_LAYER,
  DISTRICTS_LABEL_SOURCE,
  DISTRICTS_LAYERS,
  DISTRICTS_LABEL_LAYERS,
  DISTRICTS_LINE_LAYER,
  DISTRICTS_SELECTED_FILL_LAYER,
  DISTRICTS_SELECTED_LAYER,
  DISTRICTS_SHAPE_LAYERS,
  DISTRICTS_SOURCE,
  addDistrictsLayers,
  checkImage,
  districtsColors,
  districtsGeoJson,
  hasDistrictsLayers,
  removeDistrictsLayers,
  setDistrictsData,
  setDistrictsLabelOnly,
  setDistrictsVisible,
  setSelectedUnit,
  unitNameVariants,
} from '../districtsLayer'
import { FakeMap } from './fakeMap'

const AREA = testArea()

function unitCoverage(id: string, name: string, pct: number, state: UnitState, label: [number, number]): UnitCoverage {
  return { id, name, kind: 'quartier', commune: 'Testville', label, visited: pct, total: 100, pct, state, kmRun: 1, lastRunDate: null, distanceKm: 1 }
}

const label = (id: string) => AREA.features.find((f) => f.properties.id === id)!.properties.label

/** Alpha complete, Bravo partly, Delta fog; Charlie has no runnable cell and is left out. */
const COVERAGE: AreaCoverage = {
  areaId: AREA.runomics.id,
  version: AREA.runomics.version,
  units: [
    unitCoverage('test-alpha', 'Alpha', 92, 'complete', label('test-alpha')),
    unitCoverage('test-bravo', 'Bravo', 50, 'partly', label('test-bravo')),
    unitCoverage('test-delta', 'Les Îles', 10, 'fog', label('test-delta')),
  ],
  exploredPct: 50,
  completeCount: 1,
  unitCount: 3,
  nextId: 'test-bravo',
  home: null,
}

/** The run layers as useMapRoutes draws them: heat and ring under the labels, the fence on top. */
function heatMap(): FakeMap {
  const map = new FakeMap()
  map.addSource('heat', { type: 'canvas' })
  map.addLayer({ id: 'heat', type: 'raster', source: 'heat' }, 'Ocean labels')
  map.addSource('home-ring', { type: 'geojson' })
  map.addLayer({ id: 'home-ring', type: 'line', source: 'home-ring' }, 'Ocean labels')
  map.addSource('home-dot', { type: 'geojson' })
  map.addLayer({ id: 'home-dot', type: 'circle', source: 'home-dot' }, 'Ocean labels')
  map.addSource('map-edge-fence', { type: 'geojson' })
  map.addLayer({ id: 'map-edge-fence', type: 'symbol', source: 'map-edge-fence' })
  return map
}

const asMap = (map: FakeMap) => map as unknown as MapLibreMap

describe('districtsColors', () => {
  it('draws complete in the accent of the mode it is drawn in, not the heat accent', () => {
    expect(districtsColors('light', 'teal').line.complete).toBe(accentColor('teal', 'light'))
    expect(districtsColors('dark', 'teal').line.complete).toBe(accentColor('teal', 'dark'))
    expect(districtsColors('light', 'teal').line.complete).not.toBe(heatAccent('teal'))
    expect(districtsColors('light', 'violet').line.complete).toBe(accentColor('violet', 'light'))
  })

  it('takes the design spec alphas: a faint complete fill, a fainter partly one, a veil for fog', () => {
    const light = districtsColors('light', 'teal')
    expect(light.fill.complete).toMatch(/, 0\.14\)$/)
    expect(light.fill.partly).toMatch(/, 0\.04\)$/)
    expect(light.fill.fog).toMatch(/, 0\.26\)$/)
    expect(light.line.partly).toBe('rgba(0, 0, 0, 0.28)')
    const dark = districtsColors('dark', 'teal')
    expect(dark.fill.complete).toMatch(/, 0\.1\)$/)
    expect(dark.fill.fog).toMatch(/, 0\.6\)$/)
    expect(dark.line.fog).toBe('rgba(255, 255, 255, 0.24)')
  })

  it('in light mono, lifts a complete unit to paper rather than veiling it like the fog', () => {
    const mono = districtsColors('light', 'mono')
    // The mono accent is near-black: at 14% it read as a lighter fog.
    expect(mono.fill.complete).toBe('rgba(255, 255, 255, 0.55)')
    expect(mono.line.complete).toBe(accentColor('mono', 'light'))
    // Every other accent, and dark mono, keep the accent's own wash.
    expect(districtsColors('light', 'teal').fill.complete).toBe(`rgba(14, 132, 104, 0.14)`)
    expect(districtsColors('dark', 'mono').fill.complete).toMatch(/^rgba\(237, 239, 238, 0\.1\)$/)
  })
})

describe('districtsGeoJson', () => {
  it('joins every covered unit to its shape and label point, next first in placement', () => {
    const { shapes, labels } = districtsGeoJson(AREA, COVERAGE)
    expect(shapes.features.map((f) => f.properties.id)).toEqual(['test-alpha', 'test-bravo', 'test-delta'])
    expect(labels.features.map((f) => f.geometry.coordinates)).toEqual(COVERAGE.units.map((u) => u.label))
    const props = Object.fromEntries(labels.features.map((f) => [f.properties.id, f.properties]))
    expect(props['test-alpha']).toMatchObject({ pct: 92, state: 'complete', pctText: '92%', sort: 1 })
    expect(props['test-bravo']).toMatchObject({ state: 'partly', sort: 0 })
    expect(props['test-delta']).toMatchObject({ state: 'fog', sort: 3 })
  })

  it('draws nothing until the coverage is in, or when it is for another version of the area', () => {
    expect(districtsGeoJson(AREA, null).shapes.features).toEqual([])
    expect(districtsGeoJson(null, COVERAGE).labels.features).toEqual([])
    expect(districtsGeoJson(AREA, { ...COVERAGE, version: 'test-old' }).shapes.features).toEqual([])
  })
})

describe('unitNameVariants', () => {
  it('lists the lower-case spellings a base map may use', () => {
    const variants = unitNameVariants(['Les Îles', 'Metz-Centre'])
    expect(variants).toEqual(expect.arrayContaining(['les îles', 'les iles', 'les-îles', 'metz-centre', 'metz centre']))
    expect(new Set(variants).size).toBe(variants.length)
  })
})

describe('addDistrictsLayers', () => {
  it('puts the shapes over the heat and under the home ring, the labels over the quartier names and under the town and city names - the lead ones over them', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    expect(map.ids()).toEqual([
      'Background',
      'Road network',
      'heat',
      ...DISTRICTS_SHAPE_LAYERS,
      'home-ring',
      'home-dot',
      'Ocean labels',
      'Place labels',
      // Placed after the town and city names (upper layers place first), so
      // "Metz" keeps its place; before the suburbs' and quarters' own names.
      DISTRICTS_LABEL_LAYER,
      'Town labels',
      // The complete units' labels, then over them the next one's, place
      // before the town names: "Metz" gives way to them, not to the rest.
      DISTRICTS_COMPLETE_LABEL_LAYER,
      DISTRICTS_NEXT_LABEL_LAYER,
      'map-edge-fence',
    ])
    expect(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER)).toEqual(['==', ['get', 'sort'], 0])
    expect(map.getFilter(DISTRICTS_COMPLETE_LABEL_LAYER)).toEqual(['==', ['get', 'sort'], 1])
    expect(map.getFilter(DISTRICTS_LABEL_LAYER)).toEqual(['>', ['get', 'sort'], 1])
    // The same label in all three; a complete one may also step aside, left
    // or right - never the next one, which would take that side from it.
    const anchorsOf = (id: string) => {
      const { 'text-variable-anchor': anchors, ...rest } = map.getLayer(id)!.layout!
      return { anchors, rest }
    }
    const plain = anchorsOf(DISTRICTS_LABEL_LAYER)
    expect(anchorsOf(DISTRICTS_NEXT_LABEL_LAYER)).toEqual(plain)
    expect(anchorsOf(DISTRICTS_COMPLETE_LABEL_LAYER).rest).toEqual(plain.rest)
    expect(plain.anchors).toEqual(['center', 'top', 'bottom'])
    expect(anchorsOf(DISTRICTS_COMPLETE_LABEL_LAYER).anchors).toEqual(['center', 'top', 'bottom', 'right', 'left'])
    for (const id of [DISTRICTS_COMPLETE_LABEL_LAYER, DISTRICTS_NEXT_LABEL_LAYER]) {
      expect(map.getLayer(id)!.paint).toEqual(map.getLayer(DISTRICTS_LABEL_LAYER)!.paint)
    }
    expect(map.images.get(DISTRICTS_CHECK_IMAGE)?.options).toEqual({ pixelRatio: 2 })
  })

  it('goes under the first base label on a map without the heat, its labels under the first town name', () => {
    const map = new FakeMap()
    addDistrictsLayers(asMap(map), { mode: 'dark', accent: 'teal' })
    expect(map.ids().indexOf(DISTRICTS_FILL_LAYER)).toBe(map.ids().indexOf('Ocean labels') - DISTRICTS_SHAPE_LAYERS.length)
    expect(map.ids().indexOf(DISTRICTS_LABEL_LAYER)).toBe(map.ids().indexOf('Town labels') - 1)
  })

  it('without a town or city name in the style, puts its labels on top, under the fence', () => {
    const map = heatMap()
    map.layers = map.layers.filter((layer) => layer.id !== 'Town labels')
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    expect(map.ids().slice(-4)).toEqual([DISTRICTS_LABEL_LAYER, DISTRICTS_COMPLETE_LABEL_LAYER, DISTRICTS_NEXT_LABEL_LAYER, 'map-edge-fence'])
  })

  it('lets a label step beside its point rather than drop, when a town name is in the way', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    const layout = map.getLayer(DISTRICTS_LABEL_LAYER)!.layout!
    expect(layout['text-variable-anchor']).toEqual(['center', 'top', 'bottom'])
    expect(layout['text-radial-offset']).toBeGreaterThan(0)
    expect(layout['text-anchor']).toBeUndefined()
    expect(layout['text-allow-overlap']).toBe(false)
  })

  it('replaces itself when called again, for a new mode or accent', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    addDistrictsLayers(asMap(map), { mode: 'dark', accent: 'violet' })
    expect(map.ids().filter((id) => id.startsWith('runomics-districts'))).toHaveLength(DISTRICTS_LAYERS.length)
    const line = map.getLayer(DISTRICTS_LINE_LAYER)!.paint!['line-color'] as unknown[]
    expect(line).toContain(accentColor('violet', 'dark'))
  })

  it('labels a complete unit with its percentage in the accent and the check', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    const text = JSON.stringify(map.getLayer(DISTRICTS_LABEL_LAYER)!.layout!['text-field'])
    expect(text).toContain(`["image","${DISTRICTS_CHECK_IMAGE}"]`)
    expect(text).toContain(districtsColors('light', 'teal').label.pctComplete)
    expect(map.getLayer(DISTRICTS_LABEL_LAYER)!.layout!['text-font']).toEqual(['Metropolis Semi Bold', 'Noto Sans Semi Bold'])
  })
})

describe('the data, visibility and selection', () => {
  it('keeps the data across a re-add, so a new style draws the same units', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    setDistrictsData(asMap(map), COVERAGE, AREA)
    expect((map.getSource(DISTRICTS_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(3)

    map.setStyle({})
    expect(hasDistrictsLayers(asMap(map))).toBe(false)
    addDistrictsLayers(asMap(map), { mode: 'dark', accent: 'teal' })
    expect((map.getSource(DISTRICTS_LABEL_SOURCE)!.data as { features: unknown[] }).features).toHaveLength(3)
  })

  it('hides and shows its own layers only', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    setDistrictsVisible(asMap(map), false)
    for (const id of DISTRICTS_LAYERS) expect(map.getLayoutProperty(id, 'visibility')).toBe('none')
    expect(map.getLayer('heat')!.layout).toBeUndefined()
    setDistrictsVisible(asMap(map), true)
    for (const id of DISTRICTS_LAYERS) expect(map.getLayoutProperty(id, 'visibility')).toBe('visible')
  })

  it('outlines the selected unit, and nothing once cleared', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    setSelectedUnit(asMap(map), 'test-bravo')
    expect(map.getFilter(DISTRICTS_SELECTED_LAYER)).toEqual(['==', ['get', 'id'], 'test-bravo'])
    expect(map.getFilter(DISTRICTS_SELECTED_FILL_LAYER)).toEqual(['==', ['get', 'id'], 'test-bravo'])
    setSelectedUnit(asMap(map), null)
    expect(map.getFilter(DISTRICTS_SELECTED_LAYER)).toEqual(['==', ['get', 'id'], ''])
  })
  it('names one unit alone for the route generator, in the top label layer, a dot’s width off its point; then every unit again', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    const before = Object.fromEntries(DISTRICTS_LABEL_LAYERS.map((id) => [id, map.getFilter(id)]))
    const offset = map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset')

    setDistrictsLabelOnly(asMap(map), 'test-delta')
    expect(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER)).toEqual(['==', ['get', 'id'], 'test-delta'])
    expect(map.getFilter(DISTRICTS_LABEL_LAYER)).toEqual(['==', ['get', 'id'], ''])
    expect(map.getFilter(DISTRICTS_COMPLETE_LABEL_LAYER)).toEqual(['==', ['get', 'id'], ''])
    expect(map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset')).toBeGreaterThan(1)
    expect(map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-variable-anchor')).toContain('center')

    // Kept across a re-add (a theme swap).
    map.setStyle({})
    addDistrictsLayers(asMap(map), { mode: 'dark', accent: 'teal' })
    expect(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER)).toEqual(['==', ['get', 'id'], 'test-delta'])

    setDistrictsLabelOnly(asMap(map), null)
    for (const id of DISTRICTS_LABEL_LAYERS) expect(map.getFilter(id)).toEqual(before[id])
    expect(map.getLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset')).toBe(offset)
  })
})

describe('one name per quartier', () => {
  const placeFilter = () => new FakeMap().getFilter('Place labels')

  it('drops the base place names that name a unit while the layer shows, on top of their own filter', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    // No coverage yet, no names of ours: the base names stay as they are.
    expect(map.getFilter('Place labels')).toEqual(placeFilter())

    setDistrictsData(asMap(map), COVERAGE, AREA)
    const filter = map.getFilter('Place labels') as unknown[]
    expect(filter[0]).toBe('all')
    expect(filter[1]).toEqual(placeFilter())
    expect(JSON.stringify(filter)).toContain('"les iles"')
    // The layer printed name:en first: that name is checked too.
    expect(JSON.stringify(filter)).toContain('["coalesce",["get","name:en"],["get","name"]]')
    // A layer with no filter of its own gets ours alone.
    expect((map.getFilter('Town labels') as unknown[]).slice(0, 1)).toEqual(['all'])
    // Never another layer: water names, and our own labels.
    expect(map.getFilter('Ocean labels')).toBeUndefined()
    // (ours keep their own: which units each one labels).
    expect(map.getFilter(DISTRICTS_LABEL_LAYER)).toEqual(['>', ['get', 'sort'], 1])
    expect(map.getFilter(DISTRICTS_COMPLETE_LABEL_LAYER)).toEqual(['==', ['get', 'sort'], 1])
    expect(map.getFilter(DISTRICTS_NEXT_LABEL_LAYER)).toEqual(['==', ['get', 'sort'], 0])
  })

  it('gives the base names back when the layer hides, and drops them again when it shows', () => {
    const map = heatMap()
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    setDistrictsData(asMap(map), COVERAGE, AREA)
    setDistrictsVisible(asMap(map), false)
    expect(map.getFilter('Place labels')).toEqual(placeFilter())
    expect(map.getFilter('Town labels')).toBeUndefined()
    setDistrictsVisible(asMap(map), true)
    expect(JSON.stringify(map.getFilter('Town labels'))).toContain('"bravo"')
  })
})

describe('removeDistrictsLayers', () => {
  it('takes every layer, source and the check off and restores the base filters', () => {
    const map = heatMap()
    const before = map.getStyle().layers
    addDistrictsLayers(asMap(map), { mode: 'light', accent: 'teal' })
    setDistrictsData(asMap(map), COVERAGE, AREA)
    setSelectedUnit(asMap(map), 'test-alpha')

    removeDistrictsLayers(asMap(map))
    expect(map.getStyle().layers).toEqual(before)
    expect([...map.sources.keys()].filter((id) => id.startsWith('runomics'))).toEqual([])
    expect(map.hasImage(DISTRICTS_CHECK_IMAGE)).toBe(false)
    // Twice is fine: everything is guarded.
    expect(() => removeDistrictsLayers(asMap(map))).not.toThrow()
  })

  it('is safe on a map that never had the layer', () => {
    expect(() => removeDistrictsLayers(asMap(new FakeMap()))).not.toThrow()
  })
})

describe('checkImage', () => {
  it('is a 10 pt check at pixel ratio 2: the colour on the stroke, clear in the corners', () => {
    const image = checkImage('#0e8468', 'rgba(255, 255, 255, 0.85)')
    expect(image).toMatchObject({ width: 20, height: 20 })
    const px = (x: number, y: number) => [...image.data.slice(4 * (y * 20 + x), 4 * (y * 20 + x) + 4)]
    expect(px(0, 0)[3]).toBe(0)
    expect(px(19, 19)[3]).toBe(0)
    // (4.2, 7.5) pt is the check's elbow: solid accent.
    expect(px(8, 15)).toEqual([14, 132, 104, 255])
  })
})
