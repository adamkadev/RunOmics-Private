/**
 * Plain GPX 1.1 with one track and no extensions: Garmin Connect, Strava and
 * Komoot all import it as a course. The loop is always closed, because a course
 * ending a few metres short of its start shows up as point-to-point on some
 * watches.
 */

export interface GpxInput {
  name: string
  description?: string
  /** ISO timestamp for `<metadata><time>`, e.g. '2026-10-22T07:30:00.000Z'. */
  time?: string
  /** [lon, lat] or [lon, lat, ele], as the routing provider returns them. */
  points: readonly (readonly number[])[]
}

/** Characters XML 1.0 refuses outright, even escaped. */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export function escapeXml(text: string): string {
  return text.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => ENTITIES[c]!)
}

interface Point {
  lat: string
  lon: string
  ele: string | null
}

function toPoint(p: readonly number[]): Point | null {
  const [lon, lat, ele] = p
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return {
    lat: lat!.toFixed(6),
    lon: lon!.toFixed(6),
    ele: ele !== undefined && Number.isFinite(ele) ? ele.toFixed(1) : null,
  }
}

function trkpt({ lat, lon, ele }: Point): string {
  return ele === null
    ? `      <trkpt lat="${lat}" lon="${lon}"/>`
    : `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`
}

export function buildGpx({ name, description, time, points }: GpxInput): string {
  const track = points.map(toPoint).filter((p): p is Point => p !== null)
  const first = track[0]
  const last = track[track.length - 1]
  // Compared as written (6 decimals), so a float wobble below 0.1 m doesn't
  // add a duplicate point.
  if (first && last && track.length > 1 && (first.lat !== last.lat || first.lon !== last.lon)) {
    track.push(first)
  }

  const title = escapeXml(name)
  const metadata = [
    `    <name>${title}</name>`,
    ...(description ? [`    <desc>${escapeXml(description)}</desc>`] : []),
    ...(time ? [`    <time>${escapeXml(time)}</time>`] : []),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="RunOmics" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    ...metadata,
    '  </metadata>',
    '  <trk>',
    `    <name>${title}</name>`,
    '    <type>running</type>',
    '    <trkseg>',
    ...track.map(trkpt),
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n')
}

/** Letters a decomposition leaves whole, spelled out so they survive the ASCII filter. */
const LIGATURES: Readonly<Record<string, string>> = { œ: 'oe', Œ: 'oe', æ: 'ae', Æ: 'ae', ß: 'ss' }

/** 'Old Town', 8.4 → 'runomics-old-town-8km.gpx': lowercase ASCII survives every share sheet and watch. */
export function gpxFileName(unitName: string, km: number): string {
  const words = unitName
    .replace(/[œŒæÆß]/g, (c) => LIGATURES[c]!)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const rounded = Number.isFinite(km) ? Math.max(0, Math.round(km)) : 0
  return ['runomics', ...words, `${rounded}km.gpx`].join('-')
}
