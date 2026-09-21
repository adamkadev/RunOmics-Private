import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { showPlaceLabelsAtAnyZoom } from '../maplibre'

interface Layer {
  id: string
  type: string
  'source-layer'?: string
}

function fakeMap(layers: Layer[]) {
  const zoomRanges: [string, number, number][] = []
  const paint: [string, string, unknown][] = []

  const map = {
    getStyle: () => ({ layers }),
    setLayerZoomRange: (id: string, min: number, max: number) => zoomRanges.push([id, min, max]),
    setPaintProperty: (id: string, prop: string, value: unknown) => paint.push([id, prop, value]),
  } as unknown as MapLibreMap

  return { map, zoomRanges, paint }
}

const PLACE_LAYERS: Layer[] = [
  { id: 'City labels', type: 'symbol', 'source-layer': 'city_label' },
  { id: 'Town labels', type: 'symbol', 'source-layer': 'town_label' },
  { id: 'Place label', type: 'symbol', 'source-layer': 'place_label' },
]

describe('showPlaceLabelsAtAnyZoom', () => {
  it('opens the zoom window a small preview never reaches', () => {
    const { map, zoomRanges } = fakeMap(PLACE_LAYERS)

    showPlaceLabelsAtAnyZoom(map)

    expect(zoomRanges).toEqual([
      ['City labels', 0, 24],
      ['Town labels', 0, 24],
      ['Place label', 0, 24],
    ])
  })

  it('overrides the opacity step too, which alone would still hide them', () => {
    const { map, paint } = fakeMap(PLACE_LAYERS)

    showPlaceLabelsAtAnyZoom(map)

    expect(paint).toEqual([
      ['City labels', 'text-opacity', 1],
      ['Town labels', 'text-opacity', 1],
      ['Place label', 'text-opacity', 1],
    ])
  })

  it('leaves every other label alone, so roads and water keep the zoom rules the style set', () => {
    const { map, zoomRanges, paint } = fakeMap([
      { id: 'Road labels', type: 'symbol', 'source-layer': 'transportation_name' },
      { id: 'Lake labels', type: 'symbol', 'source-layer': 'water_name' },
    ])

    showPlaceLabelsAtAnyZoom(map)

    expect(zoomRanges).toEqual([])
    expect(paint).toEqual([])
  })

  it('ignores non-label layers drawn from the same source layer', () => {
    const { map, zoomRanges } = fakeMap([
      { id: 'Residential', type: 'fill', 'source-layer': 'place_label' },
      { id: 'Land outline', type: 'line' },
    ])

    showPlaceLabelsAtAnyZoom(map)

    expect(zoomRanges).toEqual([])
  })
})
