import { formatDistance } from '@/lib/formatters'
import { t } from '@/i18n'

export function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

/**
 * "0 2 4 6.1 km". A round tick within a step of the end gives way to it: the end label carries its unit, so half a
 * step still runs the two together ("1011.5 km" on a 11.5 km run).
 */
export function distanceAxis(distanceKm: number): { ticks: number[]; format: (v: number) => string } {
  const round = kmTicks(distanceKm)
  const step = round[1] ?? distanceKm
  const inner = round.filter((v) => distanceKm - v >= step)
  const ticks = distanceKm > 0 ? [...inner, distanceKm] : inner
  return {
    ticks,
    format: (v) => (v === distanceKm && v > 0 ? `${formatDistance(v)} ${t.units.km}` : `${v}`),
  }
}
