import { buildGpx, gpxFileName } from '@/domain/explore/gpx'
import { t } from '@/i18n'
import { formatDecimal } from '@/lib/formatters'

export const GPX_MIME = 'application/gpx+xml'

/** The loop alone, never the way from home, which only the map draws. */
export function routeGpxFile({
  unitName,
  coordinates,
  distanceM,
  time,
}: {
  unitName: string
  coordinates: readonly (readonly number[])[]
  distanceM: number
  /** ISO timestamp for the file's metadata. */
  time: string
}): File {
  const km = distanceM / 1000
  const e = t.pages.map.explore
  const gpx = buildGpx({
    name: e.gpxName(unitName, formatDecimal(km, 1)),
    description: e.gpxDescription(unitName),
    time,
    points: coordinates,
  })
  return new File([gpx], gpxFileName(unitName, km), { type: GPX_MIME })
}
