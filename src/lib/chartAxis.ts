import { t } from '@/i18n'

/**
 * Recharts picks round ticks only when it chooses the domain itself; a padded data-derived domain lands
 * them on arbitrary fractions (146/155/164). Doubling the step keeps every tick a multiple of the original.
 */

const MAX_TICKS = 6

export interface RoundAxis {
  domain: [number, number]
  ticks: number[]
  /** A formatter coarser than the step prints 1.05 and 1.10 both as "1.1". */
  decimals: number
}

function decimalsOf(step: number): number {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

export function roundAxis(values: (number | null | undefined)[], step: number): RoundAxis | undefined {
  if (!Number.isFinite(step) || step <= 0) return undefined
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!finite.length) return undefined

  const lo = Math.min(...finite)
  const hi = Math.max(...finite)
  const decimals = decimalsOf(step)
  const tidy = (v: number) => Number(v.toFixed(decimals))
  // Settle the quotient before rounding: 1.2 / 0.05 is 23.999999999999996.
  const quotient = (v: number, size: number) => Number((v / size).toFixed(9))

  let size = step
  while (Math.ceil(quotient(hi, size)) - Math.floor(quotient(lo, size)) > MAX_TICKS - 1) size *= 2

  let from = tidy(Math.floor(quotient(lo, size)) * size)
  let to = tidy(Math.ceil(quotient(hi, size)) * size)
  // Every reading identical and sitting on a boundary collapses the domain.
  if (from === to) {
    from = tidy(from - size)
    to = tidy(to + size)
  }

  const ticks: number[] = []
  for (let v = from; v <= to + size / 2; v += size) ticks.push(tidy(v))

  return { domain: [from, to], ticks, decimals }
}

/** Faster is up on every pace axis: pace is seconds per km, so the axis runs reversed. */
export function paceAxis(): { reversed: true; caption: string } {
  return { reversed: true, caption: t.paceAxis.caption }
}

/** Past this many months a full label no longer fits every tick at 393 pt. */
const MONTH_INITIALS_OVER = 6

/** `interval: 0`, or Recharts drops a month to make room; past six months each tick shortens to its initial. */
export function monthAxis(count: number): { interval: 0; tickFormatter: (label: string) => string } {
  return {
    interval: 0,
    tickFormatter: (label: string) => (count > MONTH_INITIALS_OVER ? label.slice(0, 1) : label),
  }
}
