import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { WATER_LABEL_LAYER, addWaterLabels, firstSymbolLayerId, isPlaceLabelLayer, styleRunMapLabels } from '../maplibre'

type Layer = { id: string; type: string; 'source-layer'?: string; source?: string }

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
    addLayer: (layer: Record<string, unknown>) => { layers.push(layer as unknown as Layer) },
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

  // v4.13.1: on device the zoom gate and the class filter left the map with no
  // names at all; towns, villages and quartiers all show, at any zoom.
  it('shows every kind of place at any zoom, filtering none out', () => {
    const { map, zooms, setFilters } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(zooms).toEqual({ Town: [0, 24], Neighbourhood: [0, 24], 'Place labels': [0, 24] })
    expect(setFilters).toEqual({})
  })

  // 3.0.1: the style's zoom steps faded districts out, so the share card had none.
  it('draws every place name it keeps fully opaque', () => {
    const { map, paint } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    for (const id of ['Town', 'Neighbourhood', 'Place labels']) expect(paint[id]?.['text-opacity'], id).toBe(1)
  })

  // The share card asks for its districts a step fainter than its towns.
  it('fades only the districts when the caller asks for it', () => {
    const { map, paint } = fakeMap(layers)
    styleRunMapLabels(map, { ...COLORS, districtOpacity: 0.7 })
    expect(paint.Neighbourhood?.['text-opacity']).toBe(0.7)
    expect(paint.Town?.['text-opacity']).toBe(1)
  })

  it('makes every name collide, on or beside its point, muted, with a halo in the surface colour', () => {
    const { map, layout, paint } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    // 3.0.1: a step smaller on the card's 300 px map, and free to sit beside its point.
    expect(layout.Town).toMatchObject({
      'text-allow-overlap': false,
      'text-padding': 2,
      'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.4,
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
    expect(added.layout!['text-optional']).toBe(true)
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
