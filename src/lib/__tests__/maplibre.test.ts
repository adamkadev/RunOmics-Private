import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { firstSymbolLayerId, isLegacyFilter, isPlaceLabelLayer, styleRunMapLabels, townsOnly } from '../maplibre'

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

  it('shows towns at any zoom and neighbourhoods only from zoom 14', () => {
    const { map, zooms } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(zooms.Town).toEqual([0, 24])
    expect(zooms.Neighbourhood).toEqual([14, 24])
  })

  it('narrows a layer holding every kind of place to towns and villages', () => {
    const { map, setFilters } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(setFilters['Place labels']).toEqual(['match', ['get', 'class'], ['city', 'town', 'village'], true, false])
    expect(setFilters.Town).toBeUndefined()
  })

  it('makes every name collide, centred, muted, with a halo in the surface colour', () => {
    const { map, layout, paint } = fakeMap(layers)
    styleRunMapLabels(map, COLORS)
    expect(layout.Town).toMatchObject({ 'text-allow-overlap': false, 'text-padding': 4, 'text-variable-anchor': ['center'], 'text-size': 12 })
    expect(layout.Neighbourhood?.['text-size']).toBe(11)
    expect(paint.Town).toEqual({ 'text-color': '#9a9f9f', 'text-halo-color': '#161818', 'text-halo-width': 1.5, 'text-halo-blur': 0.5 })
    expect(paint.Neighbourhood?.['text-color']).toBe('#6e7373')
  })
})

describe('the filter helpers', () => {
  it('tells an old-style filter from an expression', () => {
    expect(isLegacyFilter(['==', 'class', 'town'])).toBe(true)
    expect(isLegacyFilter(['all', ['==', 'class', 'town']])).toBe(true)
    expect(isLegacyFilter(['==', ['get', 'class'], 'town'])).toBe(false)
  })

  it('narrows in the syntax the layer already uses', () => {
    expect(townsOnly(['==', 'rank', 1])).toEqual(['all', ['==', 'rank', 1], ['in', 'class', 'city', 'town', 'village']])
    expect(townsOnly(['<=', ['get', 'rank'], 3])).toEqual(['all', ['<=', ['get', 'rank'], 3], ['match', ['get', 'class'], ['city', 'town', 'village'], true, false]])
  })

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
