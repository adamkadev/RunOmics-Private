import { describe, it, expect } from 'vitest'
import { HILLSHADE_LAYER, HILLSHADE_SOURCE, buildMapStyle, huedColors, withKeyPlaceholder, type StyleJson } from '../buildMapStyle'
import { MAP_STYLE_COLORS } from '@/lib/themeTokens'
import light from '../styles/runomics-light.json'
import dark from '../styles/runomics-dark.json'

const c = MAP_STYLE_COLORS.dark

// A few layers the way MapTiler names them, to be matched by pattern.
const SOURCE: StyleJson = {
  version: 8,
  id: 'dataviz',
  metadata: { editor: true },
  sources: { planet: { type: 'vector', url: 'https://api.maptiler.com/tiles/v4/tiles.json?key=ABC123' } },
  glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=ABC123',
  layers: [
    { id: 'Background', type: 'background', paint: { 'background-color': 'hsl(30,25%,98%)' } },
    { id: 'Wood', type: 'fill', 'source-layer': 'wood', paint: { 'fill-color': 'hsla(96, 44%, 79%, 0.2)' } },
    { id: 'Stadium', type: 'fill', 'source-layer': 'leisure', paint: { 'fill-color': 'hsl(85,26%,85%)', 'fill-outline-color': 'hsl(85,26%,77%)' } },
    { id: 'Water shadow', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': 'hsl(187,36%,80%)' } },
    { id: 'Water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': 'hsl(187,36%,87%)', 'fill-translate': [0, 2] } },
    { id: 'River', type: 'line', 'source-layer': 'waterway', paint: { 'line-color': 'hsl(187,37%,87%)' } },
    { id: 'Road network outline', type: 'line', 'source-layer': 'road', paint: { 'line-color': 'hsl(0,0%,85%)' } },
    { id: 'Road network', type: 'line', 'source-layer': 'road', paint: { 'line-color': 'hsl(0,0%,100%)' } },
    { id: 'Pathway outline', type: 'line', 'source-layer': 'pathway', minzoom: 16, paint: { 'line-color': 'hsl(0,0%,100%)' } },
    { id: 'Pathway line', type: 'line', 'source-layer': 'pathway', minzoom: 14, paint: { 'line-color': 'hsl(0,0%,100%)' } },
    { id: 'Railway', type: 'line', 'source-layer': 'railway', paint: { 'line-color': 'hsl(0,0%,80%)' } },
    { id: 'Railway dash', type: 'line', 'source-layer': 'railway', paint: { 'line-color': 'hsl(0,0%,100%)' } },
    { id: 'Building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': 'hsl(0,0%,92%)' } },
    { id: 'Building top', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': 'hsl(0,0%,92%)' } },
    { id: 'Other border', type: 'line', 'source-layer': 'sub_border', paint: { 'line-color': 'hsl(356,32%,83%)' } },
    { id: 'Country border', type: 'line', 'source-layer': 'country_border', paint: { 'line-color': 'hsl(356,32%,70%)' } },
    { id: 'Road labels', type: 'symbol', 'source-layer': 'road_label', minzoom: 14, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] }, paint: { 'text-color': 'hsl(205,11%,47%)' } },
    { id: 'Pathway labels', type: 'symbol', 'source-layer': 'pathway_label', minzoom: 15, layout: { 'text-field': '{name}' }, paint: { 'text-color': 'hsl(205,11%,47%)' } },
    { id: 'Place labels', type: 'symbol', 'source-layer': 'place_label', layout: { 'text-field': '{name}' }, paint: { 'text-color': 'hsl(204,11%,47%)' } },
    { id: 'District labels', type: 'symbol', 'source-layer': 'place_label', minzoom: 13, filter: ['match', ['get', 'class'], ['neighbourhood', 'quarter', 'suburb'], true, false], layout: { 'text-field': '{name}' }, paint: { 'text-opacity': ['step', ['zoom'], 0, 14, 1] } },
    { id: 'Bus stops', type: 'symbol', 'source-layer': 'poi', layout: { 'icon-image': 'bus' } },
    { id: '3D buildings', type: 'fill-extrusion', 'source-layer': 'building' },
  ],
}

const built = buildMapStyle(SOURCE, 'RunOmics Dark', c)
const layer = (id: string) => built.layers.find((l) => l.id === id)!
const hidden = (id: string) => layer(id).layout?.visibility === 'none'

describe('buildMapStyle (v4.17)', () => {
  it('paints ground, land and buildings in the token greys, parks and water in their muted hue', () => {
    expect(layer('Background').paint).toMatchObject({ 'background-color': c.background })
    expect(layer('Wood').paint).toMatchObject({ 'fill-color': c.park, 'fill-opacity': 1 })
    expect(layer('Stadium').paint).toMatchObject({ 'fill-color': c.park, 'fill-outline-color': c.park })
    expect(layer('Water').paint).toEqual({ 'fill-color': c.water })
    expect(layer('River').paint).toMatchObject({ 'line-color': c.waterway })
    expect(layer('Building').paint).toMatchObject({ 'fill-color': c.building })
  })

  it('gives major roads the contrast and minor roads a quieter grey', () => {
    expect(layer('Road network').paint!['line-color']).toEqual(['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], c.roadMajor, c.roadMinor])
    expect(layer('Road network outline').paint).toMatchObject({ 'line-color': c.roadCasing })
  })

  it('keeps footpaths visible from zoom 13: runners use them', () => {
    expect(layer('Pathway line').minzoom).toBe(13)
    expect(layer('Pathway line').paint).toMatchObject({ 'line-color': c.path })
    expect(hidden('Pathway outline')).toBe(true)
  })

  it('draws rail as one dashed grey line', () => {
    expect(layer('Railway').paint).toMatchObject({ 'line-color': c.rail, 'line-dasharray': [2, 2] })
    expect(hidden('Railway dash')).toBe(true)
  })

  it('hides the fake 3D, shadows, sub-national borders and points of interest', () => {
    for (const id of ['Building top', 'Water shadow', 'Other border', 'Bus stops', '3D buildings']) expect(hidden(id), id).toBe(true)
    expect(layer('Country border').paint).toMatchObject({ 'line-color': c.border })
  })

  it('shows street names from zoom 14 in faint ink, places in muted, on the ground as halo', () => {
    expect(layer('Road labels').minzoom).toBe(14)
    expect(layer('Pathway labels').minzoom).toBe(14)
    expect(layer('Road labels').paint).toMatchObject({ 'text-color': c.streetLabel, 'text-halo-color': c.halo })
    expect(layer('Road labels').layout).toMatchObject({ 'text-size': 11 })
    expect(layer('Place labels').paint).toMatchObject({ 'text-color': c.placeLabel, 'text-halo-color': c.halo })
    expect(layer('Place labels').layout!['text-field']).toEqual(['coalesce', ['get', 'name:en'], ['get', 'name']])
  })

  it('adds a faint hillshade once, above the land and below the water', () => {
    const ids = built.layers.map((l) => l.id)
    expect(ids.indexOf(HILLSHADE_LAYER)).toBeGreaterThan(ids.indexOf('Stadium'))
    expect(ids.indexOf(HILLSHADE_LAYER)).toBeLessThan(ids.indexOf('Water shadow'))
    expect(built.sources[HILLSHADE_SOURCE]).toMatchObject({ type: 'raster-dem', url: expect.stringContaining('key={key}') })
    const alpha = String(layer(HILLSHADE_LAYER).paint!['hillshade-shadow-color']).match(/([\d.]+)\)$/)![1]
    expect(Number(alpha)).toBeLessThanOrEqual(0.07)
    const rebuilt = buildMapStyle(built, 'RunOmics Dark', c)
    expect(rebuilt.layers.filter((l) => l.id === HILLSHADE_LAYER)).toHaveLength(1)
    expect(rebuilt).toEqual(built)
  })

  // A run's map sits at zoom 12-13.
  it('names a city\'s suburbs and quarters from zoom 11, its neighbourhoods from 13', () => {
    const district = layer('District labels')
    expect(district.minzoom).toBe(11)
    expect(district.paint!['text-opacity']).toEqual([
      'step', ['zoom'], 0,
      11, ['match', ['get', 'class'], ['suburb', 'quarter'], 1, 0],
      13, ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'neighborhood'], 1, 0],
      14, 1,
    ])
    // A place layer with no district in its filter keeps its own range.
    expect(layer('Place labels').minzoom).toBeUndefined()
  })

  it('leaves no hue in a visible layer, parks and water aside, and no key in any URL', () => {
    expect(huedColors(built)).toEqual([])
    expect(JSON.stringify(built)).not.toContain('ABC123')
    expect(JSON.stringify(built)).toContain('key={key}')
    expect(built.id).toBeUndefined()
    expect(built.metadata).toBeUndefined()
  })

  it('finds a hue left behind', () => {
    expect(huedColors({ ...SOURCE, layers: SOURCE.layers.filter((l) => l.id === 'Country border') })).toHaveLength(1)
  })

  it('replaces any key, not just a known one', () => {
    expect(JSON.stringify(withKeyPlaceholder({ ...SOURCE, layers: [] }))).not.toContain('ABC123')
  })
})

describe('the committed styles', () => {
  it('are greys only, parks and water aside, and carry the placeholder, never a key', () => {
    for (const style of [light, dark] as unknown as StyleJson[]) {
      expect(huedColors(style)).toEqual([])
      const json = JSON.stringify(style)
      expect(json).toContain('key={key}')
      expect(json).not.toMatch(/key=(?!\{key\})[A-Za-z0-9]/)
    }
  })
})
