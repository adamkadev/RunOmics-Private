/** Google's encoded polyline at 1e-5° (about 1 m): a fifth of a track's JSON, finer than a heatmap or a 150 m cell shows. */

const FACTOR = 1e5

function encodeValue(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63))
    v >>= 5
  }
  out.push(String.fromCharCode(v + 63))
}

/** [lon, lat] points, written lat first as the format has it. */
export function encodePolyline(points: readonly (readonly [number, number])[]): string {
  const out: string[] = []
  let lastLat = 0
  let lastLon = 0
  for (const [lon, lat] of points) {
    const iLat = Math.round(lat * FACTOR)
    const iLon = Math.round(lon * FACTOR)
    encodeValue(iLat - lastLat, out)
    encodeValue(iLon - lastLon, out)
    lastLat = iLat
    lastLon = iLon
  }
  return out.join('')
}

/** Whole numbers in the format's characters, for a caller with its own steps or scale. */
export function encodeIntegers(values: readonly number[]): string {
  const out: string[] = []
  for (const value of values) encodeValue(value, out)
  return out.join('')
}

function readValues(text: string, take: (value: number) => void): void {
  let index = 0
  while (index < text.length) {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = text.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < text.length)
    take(result & 1 ? ~(result >> 1) : result >> 1)
  }
}

export function decodeIntegers(text: string): number[] {
  const values: number[] = []
  readValues(text, (value) => values.push(value))
  return values
}

export function decodePolyline(text: string): [number, number][] {
  const points: [number, number][] = []
  let lat = 0
  let lon = 0
  let latRead = false
  readValues(text, (value) => {
    if (!latRead) lat += value
    else {
      lon += value
      points.push([lon / FACTOR, lat / FACTOR])
    }
    latRead = !latRead
  })
  return points
}

/** `/api/map/routes?enc=p5` answers each track as a string; older pages still ask for and get arrays. */
export function decodeTracks(routes: Record<string, string | [number, number][]>): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {}
  for (const [key, track] of Object.entries(routes)) out[key] = typeof track === 'string' ? decodePolyline(track) : track
  return out
}
