import { formatDistance } from '@/lib/formatters'
import { t } from '@/i18n'

export function kmTicks(distanceKm: number): number[] {
  const step = distanceKm <= 3 ? 1 : distanceKm <= 20 ? 2 : distanceKm <= 50 ? 5 : 10
  return Array.from({ length: Math.floor(distanceKm / step) + 1 }, (_, i) => i * step)
}

/**
 * The distance axis: from 0 to the run's own distance, which carries the unit
 * ("0 2 4 6.1 km"). It had no 0 and no unit, so the reader had to guess what
 * the numbers counted. A round tick closer than half a step to the end gives
 * way to the end, so two labels never collide.
 */
export function distanceAxis(distanceKm: number): { ticks: number[]; format: (v: number) => string } {
  const round = kmTicks(distanceKm)
  const step = round[1] ?? distanceKm
  const inner = round.filter((v) => distanceKm - v >= step / 2)
  const ticks = distanceKm > 0 ? [...inner, distanceKm] : inner
  return {
    ticks,
    format: (v) => (v === distanceKm && v > 0 ? `${formatDistance(v)} ${t.units.km}` : `${v}`),
  }
}
