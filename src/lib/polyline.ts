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

export function decodePolyline(text: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lon = 0
  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = text.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < text.length)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < text.length) {
    lat += next()
    lon += next()
    points.push([lon / FACTOR, lat / FACTOR])
  }
  return points
}

/** `/api/map/routes?enc=p5` answers each track as a string; older pages still ask for and get arrays. */
export function decodeTracks(routes: Record<string, string | [number, number][]>): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {}
  for (const [key, track] of Object.entries(routes)) out[key] = typeof track === 'string' ? decodePolyline(track) : track
  return out
}
