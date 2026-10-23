import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl'
import { accentColor, type AccentId } from '@/lib/accent'
import { curatedAccent } from '@/lib/accentScale'
import { formatPercent } from '@/lib/formatters'
import { firstSymbolLayerId, isDistrictLayer, isPlaceLabelLayer } from '@/lib/maplibre'
import { HEAT_BASEMAP } from '@/lib/maptiler'
import { ink, paper, withAlpha } from '@/lib/palette'
import { EDGE_FENCE_LAYER } from '@/lib/runMapLayers'
import { SURFACES, accentTokens } from '@/lib/themeTokens'
import type { AreaCoverage, ExploreAreaFile, UnitKind, UnitState } from '@/domain/explore/types'

/**
 * MapLibre glue only, so it can be driven by a fake map in tests. Colours are literal (MapLibre reads no CSS
 * variable), so a theme or accent change removes and re-adds the whole layer.
 *
 * Order, bottom to top: the shapes over the heat raster and under the home ring; the labels over the base map's
 * quartier names and under its town and city names (upper layers place first), so a quartier wins over the base
 * map's own name for it but "Metz" keeps its place; everything under the edge fence, so no label is cut at the edge.
 */

export const DISTRICTS_SOURCE = 'runomics-districts'
export const DISTRICTS_LABEL_SOURCE = 'runomics-districts-labels'
export const DISTRICTS_FILL_LAYER = 'runomics-districts-fill'
export const DISTRICTS_FOG_LINE_LAYER = 'runomics-districts-fog-line'
export const DISTRICTS_LINE_LAYER = 'runomics-districts-line'
export const DISTRICTS_SELECTED_FILL_LAYER = 'runomics-districts-selected-fill'
export const DISTRICTS_SELECTED_LAYER = 'runomics-districts-selected'
export const DISTRICTS_LABEL_LAYER = 'runomics-districts-label'
/** The next unit's and the complete ones' labels sit in layers of their own above the town names, so "Metz" cannot hide them. */
export const DISTRICTS_NEXT_LABEL_LAYER = 'runomics-districts-label-next'
export const DISTRICTS_COMPLETE_LABEL_LAYER = 'runomics-districts-label-complete'
export const DISTRICTS_CHECK_IMAGE = 'runomics-check'

/** Shapes and lines, bottom to top, all under the home ring. */
export const DISTRICTS_SHAPE_LAYERS = [
  DISTRICTS_FILL_LAYER,
  DISTRICTS_FOG_LINE_LAYER,
  DISTRICTS_LINE_LAYER,
  DISTRICTS_SELECTED_FILL_LAYER,
  DISTRICTS_SELECTED_LAYER,
] as const
export const DISTRICTS_LABEL_LAYERS = [DISTRICTS_LABEL_LAYER, DISTRICTS_COMPLETE_LABEL_LAYER, DISTRICTS_NEXT_LABEL_LAYER] as const
export const DISTRICTS_LAYERS = [...DISTRICTS_SHAPE_LAYERS, ...DISTRICTS_LABEL_LAYERS] as const

/** The heat map's home ring (useMapRoutes): the shapes go under it, over the heat. */
const HOME_RING_LAYER = 'home-ring'

/** The base style's place font: the one stack every label here is known to be served in. */
const LABEL_FONT = ['Metropolis Semi Bold', 'Noto Sans Semi Bold']
const NAME_SIZE = 12
/** On its point, else just under or over it, by an offset in ems that clears a town name without leaving the unit. */
type LabelAnchor = 'center' | 'top' | 'bottom' | 'right' | 'left'
const LABEL_ANCHORS: LabelAnchor[] = ['center', 'top', 'bottom']
/**
 * Beside the next quartier's label, a complete unit's can find no place over or under its point, so it may also step
 * aside; the next one keeps to the three, so it never takes the side a complete one needs.
 */
const COMPLETE_LABEL_ANCHORS = [...LABEL_ANCHORS, 'right', 'left']
const LABEL_RADIAL_OFFSET = 0.25
/** The route generator's one label steps a dot's width away: the loop's start dot sits near the label point. */
const LABEL_ONLY_ANCHORS: LabelAnchor[] = ['center', 'top', 'bottom', 'right', 'left']
const LABEL_ONLY_RADIAL_OFFSET = 1.1
/** 11 px under a 12 px name. */
const PCT_SCALE = 11 / 12
const LABEL_LINE_HEIGHT = 14 / 12

export type DistrictsMode = 'light' | 'dark'

export interface DistrictsColors {
  fill: Record<UnitState, string>
  line: Record<UnitState, string>
  selected: { fill: string; line: string }
  label: { name: string; pct: string; pctComplete: string; halo: string }
  /** The check after a complete unit's percentage. */
  check: string
}

export function districtsColors(mode: DistrictsMode, accent: AccentId): DistrictsColors {
  const acc = accentColor(accent, mode)
  const s = SURFACES[mode]
  if (mode === 'light') {
    const accText = accentTokens(curatedAccent(accent), 'light')['--accent-text-glass'] ?? acc
    // Light mono's accent is near-black and a 14% wash of it reads as a lighter fog, so complete lifts the map to paper.
    const complete = accent === 'mono' ? paper(0.55) : withAlpha(acc, 0.14)
    return {
      fill: { complete, partly: withAlpha(acc, 0.04), fog: withAlpha(s.text, 0.26) },
      line: { complete: acc, partly: ink(0.28), fog: ink(0.32) },
      selected: { fill: ink(0.06), line: s.text },
      label: { name: s.text, pct: s.body, pctComplete: accText, halo: withAlpha(HEAT_BASEMAP.light.land, 0.85) },
      check: accText,
    }
  }
  return {
    fill: { complete: withAlpha(acc, 0.1), partly: withAlpha(acc, 0.03), fog: withAlpha(s.background, 0.6) },
    line: { complete: acc, partly: paper(0.3), fog: paper(0.24) },
    selected: { fill: paper(0.1), line: s.text },
    label: { name: s.text, pct: withAlpha(s.text, 0.8), pctComplete: acc, halo: ink(0.8) },
    check: acc,
  }
}

export interface DistrictShapeProps {
  id: string
  name: string
  kind: UnitKind
  pct: number
  state: UnitState
  /** "62%" / "62 %", as the label prints it. */
  pctText: string
  /** Placement priority: the next unit first, then complete, partly, fog. */
  sort: number
}

export interface DistrictsGeoJson {
  shapes: FeatureCollection<Polygon | MultiPolygon, DistrictShapeProps>
  labels: FeatureCollection<Point, DistrictShapeProps>
}

const STATE_SORT: Record<UnitState, number> = { complete: 1, partly: 2, fog: 3 }
/** The `sort` of the next unit and of a complete one: the lead labels. */
const NEXT_SORT = 0
const COMPLETE_SORT = STATE_SORT.complete

function emptyCollection<G extends Polygon | MultiPolygon | Point>(): FeatureCollection<G, DistrictShapeProps> {
  return { type: 'FeatureCollection', features: [] }
}

/** Nothing until the area and the coverage agree on the area's version; a unit the coverage dropped (no runnable cell) is not drawn. */
export function districtsGeoJson(area: ExploreAreaFile | null, coverage: AreaCoverage | null): DistrictsGeoJson {
  const shapes = emptyCollection<Polygon | MultiPolygon>()
  const labels = emptyCollection<Point>()
  if (!area || !coverage || coverage.areaId !== area.runomics.id || coverage.version !== area.runomics.version) {
    return { shapes, labels }
  }
  const byId = new Map(coverage.units.map((unit) => [unit.id, unit]))
  for (const feature of area.features) {
    const unit = byId.get(feature.properties.id)
    if (!unit) continue
    const properties: DistrictShapeProps = {
      id: unit.id,
      name: unit.name,
      kind: unit.kind,
      pct: unit.pct,
      state: unit.state,
      pctText: formatPercent(unit.pct),
      sort: unit.id === coverage.nextId ? NEXT_SORT : STATE_SORT[unit.state],
    }
    shapes.features.push({ type: 'Feature', id: unit.id, properties, geometry: feature.geometry })
    labels.features.push({
      type: 'Feature',
      id: unit.id,
      properties,
      geometry: { type: 'Point', coordinates: [...unit.label] },
    } satisfies Feature<Point, DistrictShapeProps>)
  }
  return { shapes, labels }
}

/** Straight (not premultiplied) RGBA, as MapLibre takes it; the halo ring lets it read over the heat like the text beside it. */
export function checkImage(color: string, halo: string, pixelRatio = 2): { width: number; height: number; data: Uint8Array } {
  const size = 10 * pixelRatio
  const data = new Uint8Array(size * size * 4)
  // The stroke's path in points, inside a 10 pt box.
  const path: [number, number][] = [
    [2, 5.3],
    [4.2, 7.5],
    [8.2, 2.9],
  ]
  const half = 0.85 * pixelRatio
  const haloWidth = 1.2 * pixelRatio
  const [cr, cg, cb, ca] = rgba(color)
  const [hr, hg, hb, ha] = rgba(halo)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / pixelRatio
      const py = (y + 0.5) / pixelRatio
      let d = Infinity
      for (let k = 0; k + 1 < path.length; k++) d = Math.min(d, segmentDistance(px, py, path[k]!, path[k + 1]!))
      const dp = d * pixelRatio
      const stroke = clamp01(half + 0.5 - dp) * ca
      const ring = clamp01(half + haloWidth + 0.5 - dp) * ha
      const a = stroke + ring * (1 - stroke)
      const i = 4 * (y * size + x)
      if (a <= 0) continue
      data[i] = Math.round((cr * stroke + hr * ring * (1 - stroke)) / a)
      data[i + 1] = Math.round((cg * stroke + hg * ring * (1 - stroke)) / a)
      data[i + 2] = Math.round((cb * stroke + hb * ring * (1 - stroke)) / a)
      data[i + 3] = Math.round(a * 255)
    }
  }
  return { width: size, height: size, data }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function segmentDistance(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** '#rrggbb' or 'rgba(r, g, b, a)' to [r, g, b, a] (a 0-1). */
function rgba(color: string): [number, number, number, number] {
  const hex = color.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const parts = color.match(/rgba?\(([^)]+)\)/)?.[1]?.split(/[\s,/]+/).filter(Boolean).map(Number)
  if (parts && parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1]
  return [0, 0, 0, 1]
}

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}

/** A MapLibre filter can only lower-case the tiles' names, so every other spelling (no accents, hyphens and spaces swapped) is listed here. */
export function unitNameVariants(names: readonly string[]): string[] {
  const out = new Set<string>()
  for (const name of names) {
    const base = name.trim().toLowerCase().normalize('NFC')
    if (!base) continue
    for (const spelling of [base, stripDiacritics(base)]) {
      out.add(spelling)
      out.add(spelling.replace(/-/g, ' '))
      out.add(spelling.replace(/ /g, '-'))
      out.add(spelling.replace(/\s*-\s*/g, ' - '))
    }
  }
  return [...out].sort()
}

function notNamed(field: unknown, variants: string[]): ExpressionSpecification {
  return ['!', ['in', ['downcase', ['to-string', field]], ['literal', variants]]] as unknown as ExpressionSpecification
}

type BaseLayer = Parameters<typeof isPlaceLabelLayer>[0]

/** The first village, town or city name layer above the quartier names: ours go just under it. */
function townLabelLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle().layers.filter((layer) => !layer.id.startsWith('runomics-')) as BaseLayer[]
  let lastDistrict = -1
  layers.forEach((layer, i) => {
    if (isPlaceLabelLayer(layer) && isDistrictLayer(layer)) lastDistrict = i
  })
  return layers.slice(lastDistrict + 1).find((layer) => isPlaceLabelLayer(layer) && !isDistrictLayer(layer))?.id
}

function baseLabelLayerIds(map: MapLibreMap): string[] {
  return map
    .getStyle()
    .layers.filter((layer) => !layer.id.startsWith('runomics-') && isPlaceLabelLayer(layer as Parameters<typeof isPlaceLabelLayer>[0]))
    .map((layer) => layer.id)
}

interface MapDistricts {
  data: DistrictsGeoJson
  names: string[]
  visible: boolean
  selectedId: string | null
  /** The one unit named (the route generator's), or null for every unit. */
  labelOnly: string | null
  /** The base label layers' own filters, while ours stand in for them. */
  baseFilters: Map<string, FilterSpecification | null>
}

const maps = new WeakMap<MapLibreMap, MapDistricts>()

function stateOf(map: MapLibreMap): MapDistricts {
  let state = maps.get(map)
  if (!state) {
    state = {
      data: { shapes: emptyCollection(), labels: emptyCollection() },
      names: [],
      visible: true,
      selectedId: null,
      labelOnly: null,
      baseFilters: new Map(),
    }
    maps.set(map, state)
  }
  return state
}

function restoreBaseLabels(map: MapLibreMap, state: MapDistricts): void {
  for (const [id, filter] of state.baseFilters) if (map.getLayer(id)) map.setFilter(id, filter)
  state.baseFilters.clear()
}

function hideUnitNamesFromBase(map: MapLibreMap, state: MapDistricts): void {
  if (!state.visible || state.names.length === 0) {
    restoreBaseLabels(map, state)
    return
  }
  const variants = unitNameVariants(state.names)
  for (const id of baseLabelLayerIds(map)) {
    if (!state.baseFilters.has(id)) state.baseFilters.set(id, (map.getFilter(id) as FilterSpecification | undefined) ?? null)
    const original = state.baseFilters.get(id) ?? null
    const field = map.getLayoutProperty(id, 'text-field')
    const parts: unknown[] = [notNamed(['get', 'name'], variants)]
    // The name the layer prints, when it is an expression (e.g. name:fr first).
    if (Array.isArray(field)) parts.push(notNamed(field, variants))
    map.setFilter(id, ['all', ...(original ? [original] : []), ...parts] as FilterSpecification)
  }
}

function selectionFilter(id: string | null): FilterSpecification {
  return ['==', ['get', 'id'], id ?? ''] as FilterSpecification
}

/** One unit alone goes in the top layer, so no town name takes its place. */
function labelFilters(labelOnly: string | null): Record<(typeof DISTRICTS_LABEL_LAYERS)[number], FilterSpecification> {
  if (labelOnly !== null) {
    const none = ['==', ['get', 'id'], ''] as FilterSpecification
    return {
      [DISTRICTS_LABEL_LAYER]: none,
      [DISTRICTS_COMPLETE_LABEL_LAYER]: none,
      [DISTRICTS_NEXT_LABEL_LAYER]: ['==', ['get', 'id'], labelOnly] as FilterSpecification,
    }
  }
  return {
    [DISTRICTS_LABEL_LAYER]: ['>', ['get', 'sort'], COMPLETE_SORT] as FilterSpecification,
    [DISTRICTS_COMPLETE_LABEL_LAYER]: ['==', ['get', 'sort'], COMPLETE_SORT] as FilterSpecification,
    [DISTRICTS_NEXT_LABEL_LAYER]: ['==', ['get', 'sort'], NEXT_SORT] as FilterSpecification,
  }
}

function byState(values: Record<UnitState, string | number>): ExpressionSpecification {
  return ['match', ['get', 'state'], 'complete', values.complete, 'partly', values.partly, values.fog] as ExpressionSpecification
}

function labelText(c: DistrictsColors): ExpressionSpecification {
  const name = ['get', 'name']
  const pct = ['get', 'pctText']
  return [
    'case',
    ['==', ['get', 'state'], 'complete'],
    [
      'format',
      name, {},
      '\n', {},
      pct, { 'font-scale': PCT_SCALE, 'text-color': c.label.pctComplete },
      ' ', { 'font-scale': PCT_SCALE },
      ['image', DISTRICTS_CHECK_IMAGE], { 'vertical-align': 'center' },
    ],
    ['format', name, {}, '\n', {}, pct, { 'font-scale': PCT_SCALE, 'text-color': c.label.pct }],
  ] as unknown as ExpressionSpecification
}

function districtLayers(c: DistrictsColors, visible: boolean, selectedId: string | null, labelOnly: string | null): LayerSpecification[] {
  const visibility = visible ? 'visible' : 'none'
  const labels = labelFilters(labelOnly)
  const labelLayer = (id: string, filter: FilterSpecification, anchors: string[], radialOffset = LABEL_RADIAL_OFFSET): LayerSpecification =>
    ({
      id,
      type: 'symbol',
      source: DISTRICTS_LABEL_SOURCE,
      filter,
      layout: {
        visibility,
        'text-field': labelText(c),
        'text-font': LABEL_FONT,
        'text-size': NAME_SIZE,
        'text-line-height': LABEL_LINE_HEIGHT,
        'text-max-width': 14,
        'text-variable-anchor': anchors,
        'text-radial-offset': radialOffset,
        'text-justify': 'center',
        'text-allow-overlap': false,
        'text-padding': 2,
        'symbol-sort-key': ['get', 'sort'],
      },
      paint: {
        'text-color': c.label.name,
        'text-halo-color': c.label.halo,
        'text-halo-width': 1.5,
        'text-halo-blur': 1,
      },
    }) as LayerSpecification
  return [
    {
      id: DISTRICTS_FILL_LAYER,
      type: 'fill',
      source: DISTRICTS_SOURCE,
      layout: { visibility },
      paint: { 'fill-color': byState(c.fill) },
    },
    {
      id: DISTRICTS_FOG_LINE_LAYER,
      type: 'line',
      source: DISTRICTS_SOURCE,
      filter: ['==', ['get', 'state'], 'fog'],
      layout: { visibility, 'line-join': 'round' },
      // A dash counts line widths: 4 pt dashes at 1 pt.
      paint: { 'line-color': c.line.fog, 'line-width': 1, 'line-dasharray': [4, 4] },
    },
    {
      id: DISTRICTS_LINE_LAYER,
      type: 'line',
      source: DISTRICTS_SOURCE,
      filter: ['!=', ['get', 'state'], 'fog'],
      // A complete unit's outline over its neighbours' on a shared border.
      layout: { visibility, 'line-join': 'round', 'line-sort-key': ['match', ['get', 'state'], 'complete', 1, 0] },
      paint: { 'line-color': byState(c.line), 'line-width': ['match', ['get', 'state'], 'complete', 1.5, 1] },
    },
    {
      id: DISTRICTS_SELECTED_FILL_LAYER,
      type: 'fill',
      source: DISTRICTS_SOURCE,
      filter: selectionFilter(selectedId),
      layout: { visibility },
      paint: { 'fill-color': c.selected.fill },
    },
    {
      id: DISTRICTS_SELECTED_LAYER,
      type: 'line',
      source: DISTRICTS_SOURCE,
      filter: selectionFilter(selectedId),
      layout: { visibility, 'line-join': 'round' },
      paint: { 'line-color': c.selected.line, 'line-width': 2 },
    },
    labelLayer(DISTRICTS_LABEL_LAYER, labels[DISTRICTS_LABEL_LAYER], LABEL_ANCHORS),
    labelLayer(DISTRICTS_COMPLETE_LABEL_LAYER, labels[DISTRICTS_COMPLETE_LABEL_LAYER], COMPLETE_LABEL_ANCHORS),
    labelOnly === null
      ? labelLayer(DISTRICTS_NEXT_LABEL_LAYER, labels[DISTRICTS_NEXT_LABEL_LAYER], LABEL_ANCHORS)
      : labelLayer(DISTRICTS_NEXT_LABEL_LAYER, labels[DISTRICTS_NEXT_LABEL_LAYER], LABEL_ONLY_ANCHORS, LABEL_ONLY_RADIAL_OFFSET),
  ] as LayerSpecification[]
}

export interface DistrictsLayerOptions {
  mode: DistrictsMode
  accent: AccentId
  /** Hidden keeps the data and the layers. Default true. */
  visible?: boolean
  selectedId?: string | null
  /** Names this unit alone (the route generator's); null names every unit. Default: as last set. */
  labelOnly?: string | null
}

/** With the data last set on this map; calling it again replaces everything (a new mode or accent). */
export function addDistrictsLayers(map: MapLibreMap, options: DistrictsLayerOptions): void {
  removeDistrictsLayers(map)
  const state = stateOf(map)
  state.visible = options.visible ?? true
  if (options.selectedId !== undefined) state.selectedId = options.selectedId
  if (options.labelOnly !== undefined) state.labelOnly = options.labelOnly
  const colors = districtsColors(options.mode, options.accent)

  map.addImage(DISTRICTS_CHECK_IMAGE, checkImage(colors.check, colors.label.halo), { pixelRatio: 2 })
  map.addSource(DISTRICTS_SOURCE, { type: 'geojson', data: state.data.shapes })
  map.addSource(DISTRICTS_LABEL_SOURCE, { type: 'geojson', data: state.data.labels })

  const shapesBefore = map.getLayer(HOME_RING_LAYER) ? HOME_RING_LAYER : firstSymbolLayerId(map)
  // Upper layers place first: the lead labels on top, under the fence - the
  // next one's added last, so over the complete ones'; the rest under the
  // first town name, which keeps its place over them.
  const top = map.getLayer(EDGE_FENCE_LAYER) ? EDGE_FENCE_LAYER : undefined
  const before: Record<string, string | undefined> = {
    [DISTRICTS_LABEL_LAYER]: townLabelLayerId(map) ?? top,
    [DISTRICTS_COMPLETE_LABEL_LAYER]: top,
    [DISTRICTS_NEXT_LABEL_LAYER]: top,
  }
  for (const layer of districtLayers(colors, state.visible, state.selectedId, state.labelOnly)) {
    map.addLayer(layer, layer.id in before ? before[layer.id] : shapesBefore)
  }
  hideUnitNamesFromBase(map, state)
}

/** Null draws nothing (still loading). */
export function setDistrictsData(map: MapLibreMap, coverage: AreaCoverage | null, area: ExploreAreaFile | null): void {
  const state = stateOf(map)
  state.data = districtsGeoJson(area, coverage)
  state.names = state.data.labels.features.map((f) => f.properties.name)
  ;(map.getSource(DISTRICTS_SOURCE) as GeoJSONSource | undefined)?.setData(state.data.shapes)
  ;(map.getSource(DISTRICTS_LABEL_SOURCE) as GeoJSONSource | undefined)?.setData(state.data.labels)
  if (map.getLayer(DISTRICTS_LABEL_LAYER)) hideUnitNamesFromBase(map, state)
}

export function setDistrictsVisible(map: MapLibreMap, visible: boolean): void {
  const state = stateOf(map)
  state.visible = visible
  if (!map.getLayer(DISTRICTS_LABEL_LAYER)) return
  for (const id of DISTRICTS_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  hideUnitNamesFromBase(map, state)
}

/** Outlines one unit (the quartier sheet's); null clears it. */
export function setSelectedUnit(map: MapLibreMap, id: string | null): void {
  const state = stateOf(map)
  state.selectedId = id
  for (const layer of [DISTRICTS_SELECTED_FILL_LAYER, DISTRICTS_SELECTED_LAYER]) {
    if (map.getLayer(layer)) map.setFilter(layer, selectionFilter(id))
  }
}

/** Names one unit alone (the route generator's target); null names them all again. */
export function setDistrictsLabelOnly(map: MapLibreMap, id: string | null): void {
  const state = stateOf(map)
  state.labelOnly = id
  const filters = labelFilters(id)
  for (const layer of DISTRICTS_LABEL_LAYERS) if (map.getLayer(layer)) map.setFilter(layer, filters[layer])
  if (map.getLayer(DISTRICTS_NEXT_LABEL_LAYER)) {
    map.setLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-variable-anchor', id === null ? LABEL_ANCHORS : LABEL_ONLY_ANCHORS)
    map.setLayoutProperty(DISTRICTS_NEXT_LABEL_LAYER, 'text-radial-offset', id === null ? LABEL_RADIAL_OFFSET : LABEL_ONLY_RADIAL_OFFSET)
  }
}

export function removeDistrictsLayers(map: MapLibreMap): void {
  const state = maps.get(map)
  if (state) restoreBaseLabels(map, state)
  for (const id of [...DISTRICTS_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of [DISTRICTS_SOURCE, DISTRICTS_LABEL_SOURCE]) if (map.getSource(id)) map.removeSource(id)
  if (map.hasImage(DISTRICTS_CHECK_IMAGE)) map.removeImage(DISTRICTS_CHECK_IMAGE)
}

/** A theme swap takes the layers off until its style loads. */
export function hasDistrictsLayers(map: MapLibreMap): boolean {
  return !!map.getSource(DISTRICTS_SOURCE)
}
