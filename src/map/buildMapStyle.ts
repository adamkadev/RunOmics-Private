import type { MapStyleColors } from '@/lib/themeTokens'

/**
 * RunOmics' own basemaps (v4.17), built from MapTiler's Dataviz styles by
 * scripts/build-map-styles.ts and kept in src/map/styles: the MapTiler API can
 * serve a style but not save one. Every layer is matched by a pattern on its
 * id and source layer, never by a list of names - those change between style
 * versions - and repainted in greys, so the accent-coloured run is the one
 * bright colour on the map. Parks and water keep a muted hue (3.0), and a
 * faint hillshade sits under them. Footpaths stay visible from zoom 13:
 * runners use them.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Layer = { id: string; type: string; source?: string; 'source-layer'?: string; minzoom?: number; maxzoom?: number; filter?: Json; paint?: Record<string, Json>; layout?: Record<string, Json> }
export type StyleJson = { version: number; name?: string; layers: Layer[]; sources: Record<string, Json>; [key: string]: Json | Layer[] | undefined }

/** The road classes drawn as major roads; every other class is minor. */
const MAJOR_ROADS = ['motorway', 'trunk', 'primary', 'secondary']

/** Hidden outright: points of interest, transit, house numbers, airports, fake 3D and shadows. */
const HIDE = /poi|transit|housenumber|house_num|aeroway|aviation|aerodrome|mountain_peak|shadow|building top|3d|hatching/
const PLACE_LABEL = /place|city|town|village|state|country|continent|capital/
const STREET_LABEL = /road_label|pathway_label|pedestrian_label|transportation_name|street/
/**
 * A city's districts (3.0.1): MapTiler shows them from zoom 13, and a run's
 * map sits at 12 to 13, so a loop round Metz named only "Metz". Suburbs and
 * quarters (Devant-les-Ponts, Sablon) now show from 11 and neighbourhoods
 * from 13; hamlets and the rest keep their zoom 14.
 */
const DISTRICT_MINZOOM = 11
const DISTRICT_OPACITY: Json = [
  'step', ['zoom'], 0,
  DISTRICT_MINZOOM, ['match', ['get', 'class'], ['suburb', 'quarter'], 1, 0],
  13, ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood', 'neighborhood'], 1, 0],
  14, 1,
]

/** Whether a place layer draws districts: its filter names suburbs or quarters. */
function isDistrictLayer(layer: Layer): boolean {
  return /"(suburb|quarter)"/.test(JSON.stringify(layer.filter ?? null))
}

/** Green space, drawn in the park colour (3.0). */
const PARK = /park|wood|forest|grass|cemetery|leisure|pitch|golf|garden|meadow|scrub/
/** The only layers that may keep a hue: parks and water (3.0). */
const NATURE = new RegExp(`${PARK.source}|water|river|stream|canal`)

export const HILLSHADE_SOURCE = 'runomics-terrain'
export const HILLSHADE_LAYER = 'Hillshade'
/** MapTiler's terrain, for the hillshade; lib/maptiler fills the key in. */
const TERRAIN_URL = 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key={key}'

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
      layer.layout = { ...layer.layout, 'text-size': 11 }
    } else if (/water/.test(k)) {
      paint(layer, { 'text-color': c.streetLabel, 'text-halo-color': c.halo })
    } else if (PLACE_LABEL.test(k)) {
      paint(layer, { 'text-color': c.placeLabel, 'text-halo-color': c.halo })
      if (isDistrictLayer(layer)) {
        layer.minzoom = Math.min(layer.minzoom ?? DISTRICT_MINZOOM, DISTRICT_MINZOOM)
        paint(layer, { 'text-opacity': DISTRICT_OPACITY })
      }
    } else {
      return hide(layer)
    }
    if (isNameField(layer.layout?.['text-field'])) layer.layout = { ...layer.layout, 'text-field': NAME_FIELD }
    return
  }

  // Borders: only countries (admin level 2), in a neutral line.
  if (/sub_border|admin_sub/.test(k)) return hide(layer)
  if (/border|boundary/.test(k)) {
    if (source === 'boundary' && !JSON.stringify(layer.filter ?? null).includes('admin_level')) {
      layer.filter = ['all', layer.filter ?? true, ['<=', ['get', 'admin_level'], 2]]
    }
    return paint(layer, { 'line-color': c.border })
  }

  if (layer.type === 'fill') {
    if (/water/.test(k)) return fill(layer, c.water)
    if (/building/.test(k)) return fill(layer, c.building)
    if (/pier|bridge/.test(k)) return fill(layer, c.background)
    if (PARK.test(k)) {
      fill(layer, c.park)
      return paint(layer, { 'fill-opacity': 1 })
    }
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

/**
 * Relief under the parks and water (3.0): MapTiler's terrain as a hillshade
 * at a few per cent, above the land fills and below the first water layer.
 * Added once: a rebuild of a built style keeps the one it has, repainted.
 */
function addHillshade(style: StyleJson, c: MapStyleColors): void {
  style.sources[HILLSHADE_SOURCE] = { type: 'raster-dem', url: TERRAIN_URL, tileSize: 256 }
  const shade: Layer = {
    id: HILLSHADE_LAYER,
    type: 'hillshade',
    source: HILLSHADE_SOURCE,
    maxzoom: 16,
    paint: {
      'hillshade-shadow-color': c.hillshadeShadow,
      'hillshade-highlight-color': c.hillshadeHighlight,
      'hillshade-accent-color': c.hillshadeShadow,
      'hillshade-exaggeration': 0.35,
    },
  }
  const existing = style.layers.findIndex((layer) => layer.id === HILLSHADE_LAYER)
  if (existing !== -1) {
    style.layers[existing] = shade
    return
  }
  const water = style.layers.findIndex((layer) => layer.type === 'fill' && /water/.test(key(layer)))
  style.layers.splice(water === -1 ? style.layers.length : water, 0, shade)
}

export function buildMapStyle(source: StyleJson, name: string, colors: MapStyleColors): StyleJson {
  const style: StyleJson = JSON.parse(JSON.stringify(source))
  style.name = name
  delete style.id
  delete style.metadata
  for (const layer of style.layers) if (layer.id !== HILLSHADE_LAYER) styleLayer(layer, colors)
  addHillshade(style, colors)
  return withKeyPlaceholder(style)
}

const HUED = /^(?:hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%|#([0-9a-f]{6}))/i

/** Every colour left in a visible layer that has a hue, parks and water aside: the build fails on any. */
export function huedColors(style: StyleJson): string[] {
  const found: string[] = []
  const visit = (value: Json, where: string) => {
    if (typeof value === 'string') {
      const m = HUED.exec(value)
      if (!m) return
      const saturated = m[1] !== undefined ? Number(m[1]) > 0 : (() => {
        const n = parseInt(m[2]!, 16)
        const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]
        // 10, not 8 (3.0): the handoff's greys lean green by a few steps (#4f5856).
        return Math.max(r, g, b) - Math.min(r, g, b) > 10
      })()
      if (saturated) found.push(`${where}: ${value}`)
    } else if (Array.isArray(value)) value.forEach((v) => visit(v, where))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => visit(v, `${where}.${k}`))
  }
  for (const layer of style.layers) {
    if (layer.layout?.visibility === 'none' || NATURE.test(key(layer))) continue
    visit((layer.paint ?? {}) as Json, layer.id)
  }
  return found
}
