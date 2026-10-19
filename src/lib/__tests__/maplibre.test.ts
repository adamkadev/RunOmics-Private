import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { firstSymbolLayerId, isPlaceLabelLayer, styleRunMapLabels } from '../maplibre'

type Layer = { id: string; type: string; 'source-layer'?: string }

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
