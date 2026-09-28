import type { MapStyleColors } from '@/lib/themeTokens'

/**
 * RunOmics' own basemaps (v4.17), built from MapTiler's Dataviz styles by
 * scripts/build-map-styles.ts and kept in src/map/styles: the MapTiler API can
 * serve a style but not save one. Every layer is matched by a pattern on its
 * id and source layer, never by a list of names - those change between style
 * versions - and repainted in greys, so the accent-coloured run is the one
 * colour on the map. Footpaths stay visible from zoom 13: runners use them.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Layer = { id: string; type: string; 'source-layer'?: string; minzoom?: number; filter?: Json; paint?: Record<string, Json>; layout?: Record<string, Json> }
export type StyleJson = { version: number; name?: string; layers: Layer[]; sources: Record<string, Json>; [key: string]: Json | Layer[] | undefined }

/** The road classes drawn as major roads; every other class is minor. */
const MAJOR_ROADS = ['motorway', 'trunk', 'primary', 'secondary']

/** Hidden outright: points of interest, transit, house numbers, airports, fake 3D and shadows. */
const HIDE = /poi|transit|housenumber|house_num|aeroway|aviation|aerodrome|mountain_peak|shadow|building top|3d|hatching/
const PLACE_LABEL = /place|city|town|village|state|country|continent|capital/
const STREET_LABEL = /road_label|pathway_label|pedestrian_label|transportation_name|street/

/** Where a layer matches: its id and source layer, lower-cased. */
function key(layer: Layer): string {
  return `${layer.id} ${layer['source-layer'] ?? ''}`.toLowerCase()
}

function hide(layer: Layer): void {
  layer.layout = { ...layer.layout, visibility: 'none' }
}

function paint(layer: Layer, props: Record<string, Json>): void {
  layer.paint = { ...layer.paint, ...props }
}

/** A fill in one grey, its outline too if it draws one. */
function fill(layer: Layer, color: string): void {
  delete layer.paint?.['fill-translate']
  paint(layer, { 'fill-color': color, ...(layer.paint?.['fill-outline-color'] !== undefined ? { 'fill-outline-color': color } : {}) })
}

/** A text field in the English name with the local name behind it; lib/maptiler swaps the language. */
const NAME_FIELD: Json = ['coalesce', ['get', 'name:en'], ['get', 'name']]

function isNameField(field: Json | undefined): boolean {
  return JSON.stringify(field ?? '').includes('name')
}

function styleLayer(layer: Layer, c: MapStyleColors): void {
  const k = key(layer)
  const source = (layer['source-layer'] ?? '').toLowerCase()

  if (layer.type === 'background') return paint(layer, { 'background-color': c.background })
  if (layer.type === 'fill-extrusion' || HIDE.test(k)) return hide(layer)

  if (layer.type === 'symbol') {
    if (STREET_LABEL.test(k)) {
      layer.minzoom = 14
      paint(layer, { 'text-color': c.streetLabel, 'text-halo-color': c.halo })
    } else if (/water/.test(k)) {
      paint(layer, { 'text-color': c.streetLabel, 'text-halo-color': c.halo })
    } else if (PLACE_LABEL.test(k)) {
      paint(layer, { 'text-color': c.placeLabel, 'text-halo-color': c.halo })
    } else {
      return hide(layer)
    }
    if (isNameField(layer.layout?.['text-field'])) layer.layout = { ...layer.layout, 'text-field': NAME_FIELD }
    return
  }

  // Borders: only countries (admin level 2), in a neutral line.
  if (/sub_border|admin_sub/.test(k)) return hide(layer)
  if (/border|boundary/.test(k)) {
    if (source === 'boundary') layer.filter = ['all', layer.filter ?? true, ['<=', ['get', 'admin_level'], 2]]
    return paint(layer, { 'line-color': c.border })
  }

  if (layer.type === 'fill') {
    if (/water/.test(k)) return fill(layer, c.water)
    if (/building/.test(k)) return fill(layer, c.building)
    if (/pier|bridge/.test(k)) return fill(layer, c.background)
    return fill(layer, c.land)
  }

  if (layer.type === 'line') {
    if (/waterway|river|stream|canal/.test(k)) return paint(layer, { 'line-color': c.waterway })
    if (/rail/.test(k)) {
      // One dashed line; the style's white dash overlays go.
      if (/dash/.test(k)) return hide(layer)
      return paint(layer, { 'line-color': c.rail, 'line-dasharray': [2, 2] })
    }
    if (/pathway|footway|cycleway|path|pedestrian/.test(k) && !/^road/.test(source)) {
      if (/outline|casing/.test(k)) return hide(layer)
      layer.minzoom = 13
      return paint(layer, {
        'line-color': c.path,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 18, 1.6],
        'line-opacity': 1,
      })
    }
    if (/road|transportation|tunnel|bridge|street/.test(k)) {
      if (/outline|casing/.test(k)) return paint(layer, { 'line-color': c.roadCasing })
      return paint(layer, { 'line-color': ['match', ['get', 'class'], MAJOR_ROADS, c.roadMajor, c.roadMinor] })
    }
  }
}

/** The key in every source, sprite and glyph URL, as the `{key}` lib/maptiler fills in. */
export function withKeyPlaceholder(style: StyleJson): StyleJson {
  return JSON.parse(JSON.stringify(style).replace(/([?&]key=)[A-Za-z0-9_-]+/g, '$1{key}'))
}

export function buildMapStyle(source: StyleJson, name: string, colors: MapStyleColors): StyleJson {
  const style: StyleJson = JSON.parse(JSON.stringify(source))
  style.name = name
  delete style.id
  delete style.metadata
  for (const layer of style.layers) styleLayer(layer, colors)
  return withKeyPlaceholder(style)
}

const HUED = /^(?:hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%|#([0-9a-f]{6}))/i

/** Every colour left in a visible layer that has a hue: the build fails on any. */
export function huedColors(style: StyleJson): string[] {
  const found: string[] = []
  const visit = (value: Json, where: string) => {
    if (typeof value === 'string') {
      const m = HUED.exec(value)
      if (!m) return
      const saturated = m[1] !== undefined ? Number(m[1]) > 0 : (() => {
        const n = parseInt(m[2]!, 16)
        const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]
        return Math.max(r, g, b) - Math.min(r, g, b) > 8
      })()
      if (saturated) found.push(`${where}: ${value}`)
    } else if (Array.isArray(value)) value.forEach((v) => visit(v, where))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => visit(v, `${where}.${k}`))
  }
  for (const layer of style.layers) {
    if (layer.layout?.visibility === 'none') continue
    visit((layer.paint ?? {}) as Json, layer.id)
  }
  return found
}
