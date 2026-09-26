import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { hideSymbolLabels } from '../maplibre'

describe('hideSymbolLabels', () => {
  // v4.3.3: an activity's map carries no labels; place names sat under the chips.
  it('turns every symbol layer off and leaves the others alone', () => {
    const layout: [string, string, unknown][] = []
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'Place label', type: 'symbol', 'source-layer': 'place' },
          { id: 'POI', type: 'symbol', 'source-layer': 'poi' },
          { id: 'Roads', type: 'line', 'source-layer': 'transportation' },
        ],
      }),
      setLayoutProperty: (id: string, prop: string, value: unknown) => layout.push([id, prop, value]),
    } as unknown as MapLibreMap

    hideSymbolLabels(map)

    expect(layout).toEqual([
      ['Place label', 'visibility', 'none'],
      ['POI', 'visibility', 'none'],
    ])
  })
})
