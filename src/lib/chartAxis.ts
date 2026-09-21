/**
 * Recharts only picks round ticks when it is left to choose the domain itself.
 * Charts that pad a data-derived domain instead - `[min - 5, max + 5]`,
 * `['dataMin - 3', 'dataMax + 3']`, `min * 0.97` - pin the axis ends to two
 * readings, and every tick between them lands on an arbitrary fraction of the
 * gap: 146/155/164/173/180 rather than 150/160/170/180.
 *
 * roundAxis snaps the domain outward to whole multiples of `step` and returns
 * the ticks that fall on them. It doubles the step - 5 -> 10 -> 20, 15 -> 30 ->
 * 60 - until the axis holds at most MAX_TICKS, so a wide window widens the
 * spacing instead of crowding the gutter. Doubling keeps every tick a multiple
 * of the original step, which is what makes the labels readable.
 *
 * Static ticks (HrChart's HR_TICKS, CadenceChart's CADENCE_TICKS) stay static:
 * they cover a fixed physiological range. This is for the windowed charts,
 * where the range moves with the data and a fixed one would flatten the line.
 */

const MAX_TICKS = 6

export interface RoundAxis {
  domain: [number, number]
  ticks: number[]
  /** How many decimals a tick label needs. A formatter coarser than the step
   *  prints the same label twice - 1.05 and 1.10 both become "1.1". */
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
  // Snapping divides by the step, so 1.2 / 0.05 = 23.999999999999996 would
  // floor a whole step too low. Settle the quotient before rounding it.
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
