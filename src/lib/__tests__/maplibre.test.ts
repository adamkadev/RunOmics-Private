import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { isPlaceLabelLayer, showPlaceLabelsOnly } from '../maplibre'

describe('showPlaceLabelsOnly', () => {
  // v4.8 2h: the map names its town again; streets and POIs stay off.
  it('keeps the place names, at any zoom, and turns every other label off', () => {
    const layout: [string, string, unknown][] = []
    const zooms: [string, number, number][] = []
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'Place label', type: 'symbol', 'source-layer': 'place' },
          { id: 'Town labels', type: 'symbol', 'source-layer': 'town_label' },
          { id: 'POI', type: 'symbol', 'source-layer': 'poi' },
          { id: 'Road labels', type: 'symbol', 'source-layer': 'transportation_name' },
          { id: 'Roads', type: 'line', 'source-layer': 'transportation' },
        ],
      }),
      setLayoutProperty: (id: string, prop: string, value: unknown) => layout.push([id, prop, value]),
      setLayerZoomRange: (id: string, min: number, max: number) => zooms.push([id, min, max]),
    } as unknown as MapLibreMap

    showPlaceLabelsOnly(map)

    expect(layout).toEqual([
      ['Place label', 'visibility', 'visible'],
      ['Town labels', 'visibility', 'visible'],
      ['POI', 'visibility', 'none'],
      ['Road labels', 'visibility', 'none'],
    ])
    expect(zooms).toEqual([
      ['Place label', 0, 24],
      ['Town labels', 0, 24],
    ])
  })

  it('knows a place layer by its id when the source layer says nothing', () => {
    expect(isPlaceLabelLayer({ id: 'Village labels', type: 'symbol' })).toBe(true)
    expect(isPlaceLabelLayer({ id: 'Suburb', type: 'symbol', 'source-layer': 'other' })).toBe(true)
    expect(isPlaceLabelLayer({ id: 'Highway shield', type: 'symbol' })).toBe(false)
    expect(isPlaceLabelLayer({ id: 'place fill', type: 'fill' })).toBe(false)
  })
})
