import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { showPlacesAtAnyZoom, LANDMARK_LABEL_LAYER, PARK_LABEL_LAYER, WATER_LABEL_LAYER, addLandmarkLabels, addParkLabels, addWaterLabels, firstSymbolLayerId, isPlaceLabelLayer, styleRunMapLabels } from '../maplibre'

type Layer = { id: string; type: string; 'source-layer'?: string; source?: string; filter?: unknown }

function fakeMap(layers: Layer[], filters: Record<string, unknown> = {}) {
  const layout: Record<string, Record<string, unknown>> = {}
  const paint: Record<string, Record<string, unknown>> = {}
  const zooms: Record<string, [number, number]> = {}
  const setFilters: Record<string, unknown> = {}
  const map = {
    getStyle: () => ({ layers }),
    setLayoutProperty: (id: string, k: string, v: unknown) => { (layout[id] ??= {})[k] = v },
    setPaintProperty: (id: string, k: string, v: unknown) => { (paint[id] ??= {})[k] = v },
    setLayerZoomRange: (id: string, min: number, max: number) => { zooms[id] = [min, max] },
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer: (layer: Record<string, unknown>, before?: string) => {
      const at = before ? layers.findIndex((l) => l.id === before) : -1
      if (at < 0) layers.push(layer as unknown as Layer)
      else layers.splice(at, 0, layer as unknown as Layer)
    },
    getFilter: (id: string) => filters[id],
    setFilter: (id: string, f: unknown) => { setFilters[id] = f },
  } as unknown as MapLibreMap
  return { map, layout, paint, zooms, setFilters }
}

const COLORS = { halo: '#161818', town: '#9a9f9f', neighbourhood: '#6e7373' }

describe('styleRunMapLabels (v4.10)', () => {
  const layers: Layer[] = [
    { id: 'Water', type: 'fill' },
    { id: 'Road labels', type: 'symbol', 'source-layer': 'transportation_name' },
    { id: 'POI', type: 'symbol', 'source-layer': 'poi' },
    { id: 'Town', type: 'symbol', 'source-layer': 'place' },
    { id: 'Neighbourhood', type: 'symbol', 'source-layer': 'place' },
    { id: 'Place labels', type: 'symbol', 'source-layer': 'place' },
  ]

  it('keeps place names only and turns every other label off', () => {
    const { map, layout } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(layout['Road labels']?.visibility).toBe('none')
    expect(layout.POI?.visibility).toBe('none')
    expect(layout.Town?.visibility).toBe('visible')
    expect(layout.Water).toBeUndefined()
  })

  it('shows every kind of place at any zoom, filtering none out', () => {
    const { map, zooms, setFilters } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(zooms).toEqual({ Town: [0, 24], Neighbourhood: [0, 24], 'Place labels': [0, 24] })
    expect(setFilters).toEqual({})
  })

  it('draws every place name it keeps fully opaque', () => {
    const { map, paint } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    for (const id of ['Town', 'Neighbourhood', 'Place labels']) expect(paint[id]?.['text-opacity'], id).toBe(1)
  })

  it('fades only the districts when the caller asks for it', () => {
    const { map, paint } = fakeMap(layers)
    styleRunMapLabels(map, { ...COLORS, districtOpacity: 0.7 })
    expect(paint.Neighbourhood?.['text-opacity']).toBe(0.7)
    expect(paint.Town?.['text-opacity']).toBe(1)
  })

  it('makes every name collide, on or beside its point, muted, with a halo in the surface colour', () => {
    const { map, layout, paint } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    // A step smaller on the card's 300 px map, and free to sit beside its point.
    expect(layout.Town).toMatchObject({
      'text-allow-overlap': false,
      'text-padding': 2,
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
      'text-radial-offset': 1.2,
      'text-size': 10,
    })
    expect(layout.Neighbourhood?.['text-size']).toBe(9)
    expect(paint.Town).toEqual({ 'text-opacity': 1, 'text-color': '#9a9f9f', 'text-halo-color': '#161818', 'text-halo-width': 1.5, 'text-halo-blur': 0.5 })
    expect(paint.Neighbourhood?.['text-color']).toBe('#6e7373')
  })
})

describe('the filter helpers', () => {
  it('knows a place layer by its source layer or its id', () => {
    expect(isPlaceLabelLayer({ id: 'Village labels', type: 'symbol' })).toBe(true)
    expect(isPlaceLabelLayer({ id: 'Highway shield', type: 'symbol' })).toBe(false)
    expect(isPlaceLabelLayer({ id: 'place fill', type: 'fill' })).toBe(false)
  })

  it('finds the first label layer', () => {
    const { map } = fakeMap([{ id: 'Water', type: 'fill' }, { id: 'Road labels', type: 'symbol' }, { id: 'Town', type: 'symbol' }])
    expect(firstSymbolLayerId(map)).toBe('Road labels')
  })
})

describe('addWaterLabels (3.0.1)', () => {
  // The Planet v4 tiles name a river on water_label, as a line, with its kind
  // in class; waterway carries the geometry and no name at all.
  const styleLayers = (): Layer[] => [
    { id: 'Waterway', type: 'line', 'source-layer': 'waterway', source: 'planet' },
    { id: 'Pond labels', type: 'symbol', 'source-layer': 'water_label', source: 'planet' },
  ]

  it('names rivers and canals along their line, italic and optional', () => {
    const layers = styleLayers()
    const { map } = fakeMap(layers)
    addWaterLabels(map, { halo: '#0b0c0c', water: '#5b7d99' })

    const added = layers.find((l) => l.id === WATER_LABEL_LAYER) as unknown as Record<string, Record<string, unknown>>
    expect(added).toBeDefined()
    expect(added.source).toBe('planet')
    expect(added['source-layer']).toBe('water_label')
    expect(added.layout!['symbol-placement']).toBe('line')
    // A line label carries no icon: with text-optional MapLibre "places" the symbol with neither, and the name never draws.
    expect(added.layout!['text-optional']).toBeUndefined()
    expect(String(added.layout!['text-font'])).toContain('Italic')
    expect(added.paint!['text-color']).toBe('#5b7d99')
    expect(JSON.stringify(added.filter)).toContain('river')
    expect(JSON.stringify(added.filter)).toContain('canal')
  })

  it('adds nothing twice, and nothing at all without the source layer', () => {
    const layers = styleLayers()
    const { map } = fakeMap(layers)
    addWaterLabels(map, { halo: '#0b0c0c', water: '#5b7d99' })
    addWaterLabels(map, { halo: '#0b0c0c', water: '#5b7d99' })
    expect(layers.filter((l) => l.id === WATER_LABEL_LAYER)).toHaveLength(1)

    const bare: Layer[] = [{ id: 'Water', type: 'fill', 'source-layer': 'water', source: 'planet' }]
    addWaterLabels(fakeMap(bare).map, { halo: '#0b0c0c', water: '#5b7d99' })
    expect(bare).toHaveLength(1)
  })

  it('reads the locale name where there is one', () => {
    const layers = styleLayers()
    addWaterLabels(fakeMap(layers).map, { halo: '#0b0c0c', water: '#5b7d99', lang: 'fr' })
    const added = layers.find((l) => l.id === WATER_LABEL_LAYER) as unknown as Record<string, Record<string, unknown>>
    expect(JSON.stringify(added.layout!['text-field'])).toContain('name:fr')
  })
})

describe('addParkLabels (3.0.1)', () => {
  // A park's name is a POI point - poi_public, subclass park - not a park
  // source-layer: the polygons carry neither a name nor an area.
  const styleLayers = (): Layer[] => [
    { id: 'Leisure', type: 'fill', 'source-layer': 'leisure', source: 'planet' },
    { id: 'Townhalls', type: 'symbol', 'source-layer': 'poi_public', source: 'planet' },
  ]

  it('names a park with its tree, over the water and the districts', () => {
    const layers = styleLayers()
    addParkLabels(fakeMap(layers).map, { halo: '#0b0c0c', park: '#5f8a6d' })
    const added = layers.find((l) => l.id === PARK_LABEL_LAYER) as unknown as Record<string, Record<string, unknown>>
    expect(added['source-layer']).toBe('poi_public')
    expect(added.layout!['icon-image']).toBe('park')
    expect(added.paint!['icon-color']).toBe('#5f8a6d')
    expect(added.layout!['text-optional']).toBe(true)
    expect(JSON.stringify(added.filter)).toContain('park')
    // Park sorts before water, so it wins the room where the two collide.
    const water = styleLayers()
    water.push({ id: 'Pond labels', type: 'symbol', 'source-layer': 'water_label', source: 'planet' })
    addWaterLabels(fakeMap(water).map, { halo: '#0b0c0c', water: '#5b7d99' })
    const waterLayer = water.find((l) => l.id === WATER_LABEL_LAYER) as unknown as Record<string, Record<string, unknown>>
    expect(Number(added.layout!['symbol-sort-key'])).toBeLessThan(Number(waterLayer.layout!['symbol-sort-key']))
  })

  it('adds nothing without the POI source layer', () => {
    const bare: Layer[] = [{ id: 'Leisure', type: 'fill', 'source-layer': 'leisure', source: 'planet' }]
    addParkLabels(fakeMap(bare).map, { halo: '#0b0c0c', park: '#5f8a6d' })
    expect(bare).toHaveLength(1)
  })
})

describe('addLandmarkLabels (3.0.1)', () => {
  // The tiles split POIs by category: a castle is tourism, a museum culture.
  const styleLayers = (): Layer[] => [
    { id: 'Tourism', type: 'symbol', 'source-layer': 'poi_tourism', source: 'planet' },
    { id: 'Culture', type: 'symbol', 'source-layer': 'poi_culture', source: 'planet' },
  ]

  it('names a landmark from both POI layers, each with its own icon', () => {
    const layers = styleLayers()
    addLandmarkLabels(fakeMap(layers).map, { halo: '#0b0c0c', landmark: '#9a8ca8' })
    const added = layers.filter((l) => l.id.startsWith(LANDMARK_LABEL_LAYER)) as unknown as Record<string, Record<string, unknown>>[]
    expect(added).toHaveLength(2)
    expect(added.map((l) => l['source-layer'])).toEqual(['poi_tourism', 'poi_culture'])
    expect(JSON.stringify(added[0]!.filter)).toContain('castle')
    expect(JSON.stringify(added[1]!.filter)).toContain('museum')
    expect(JSON.stringify(added[0]!.layout!['icon-image'])).toContain('match')
    expect(added[0]!.paint!['text-color']).toBe('#9a8ca8')
  })

  it('leaves the park the louder of the two, and skips a layer the tiles lack', () => {
    const layers = styleLayers()
    layers.push({ id: 'Townhalls', type: 'symbol', 'source-layer': 'poi_public', source: 'planet' })
    const { map } = fakeMap(layers)
    addParkLabels(map, { halo: '#0b0c0c', park: '#5f8a6d' })
    addLandmarkLabels(map, { halo: '#0b0c0c', landmark: '#9a8ca8' })
    const park = layers.find((l) => l.id === PARK_LABEL_LAYER) as unknown as Record<string, Record<string, unknown>>
    const mark = layers.find((l) => l.id.startsWith(LANDMARK_LABEL_LAYER)) as unknown as Record<string, Record<string, unknown>>
    expect(Number(park.layout!['symbol-sort-key'])).toBeLessThan(Number(mark.layout!['symbol-sort-key']))

    const bare: Layer[] = [{ id: 'Culture', type: 'symbol', 'source-layer': 'poi_culture', source: 'planet' }]
    addLandmarkLabels(fakeMap(bare).map, { halo: '#0b0c0c', landmark: '#9a8ca8' })
    expect(bare.filter((l) => l.id.startsWith(LANDMARK_LABEL_LAYER))).toHaveLength(1)
  })
})

describe('showPlacesAtAnyZoom (3.0.1)', () => {
  // The style fades hamlets in at zoom 14 and drops a city label above it.
  const layers = (): Layer[] => [
    { id: 'Place labels', type: 'symbol', 'source-layer': 'place_label', filter: ['match', ['get', 'class'], ['hamlet', 'suburb', 'quarter'], true, false] },
    { id: 'City labels', type: 'symbol', 'source-layer': 'city_label' },
    { id: 'Road labels', type: 'symbol', 'source-layer': 'road_label' },
    { id: 'runomics-park-label', type: 'symbol', 'source-layer': 'poi_public' },
  ]

  it('lifts every place name to any zoom, and leaves the streets alone', () => {
    const { map, zooms, paint } = fakeMap(layers())
    showPlacesAtAnyZoom(map)

    expect(zooms['Place labels']).toEqual([0, 24])
    expect(zooms['City labels']).toEqual([0, 24])
    expect(paint['City labels']?.['text-opacity']).toBe(1)
    // Street names and this app's own layers are not place names.
    expect(zooms['Road labels']).toBeUndefined()
    expect(zooms['runomics-park-label']).toBeUndefined()
  })

  it('keeps a district as faint as the caller asks', () => {
    const { map, paint } = fakeMap(layers())
    showPlacesAtAnyZoom(map, { districtOpacity: 0.8 })
    expect(paint['Place labels']?.['text-opacity']).toBe(0.8)
    expect(paint['City labels']?.['text-opacity']).toBe(1)
  })
})

describe('where the app puts its own labels', () => {
  // Across layers the order decides, not symbol-sort-key: MapLibre places the earlier layer first,
  // so ours must sit above the style's names and the street names.
  it('places park, then landmark, then water, all before the style\'s own names', () => {
    const layers: Layer[] = [
      { id: 'Water', type: 'fill', 'source-layer': 'water', source: 'planet' },
      { id: 'Road labels', type: 'symbol', 'source-layer': 'road_label', source: 'planet' },
      { id: 'Place labels', type: 'symbol', 'source-layer': 'place_label', source: 'planet' },
      { id: 'Pond labels', type: 'symbol', 'source-layer': 'water_label', source: 'planet' },
      { id: 'Townhalls', type: 'symbol', 'source-layer': 'poi_public', source: 'planet' },
      { id: 'Tourism', type: 'symbol', 'source-layer': 'poi_tourism', source: 'planet' },
    ]
    const { map } = fakeMap(layers)
    addParkLabels(map, { halo: '#0b0c0c', park: '#5f8a6d' })
    addLandmarkLabels(map, { halo: '#0b0c0c', landmark: '#9a8ca8' })
    addWaterLabels(map, { halo: '#0b0c0c', water: '#5b7d99' })

    const order = layers.map((l) => l.id)
    const ours = order.filter((id) => id.startsWith('runomics-'))
    expect(ours[0]).toBe(PARK_LABEL_LAYER)
    expect(ours.at(-1)).toBe(WATER_LABEL_LAYER)
    expect(order.indexOf(WATER_LABEL_LAYER)).toBeLessThan(order.indexOf('Road labels'))
    expect(order.indexOf(WATER_LABEL_LAYER)).toBeLessThan(order.indexOf('Place labels'))
  })
})
