import { formatKm } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * What a pair has left, or how far past its limit it is. A pair at 1,375 of
 * 500 km read "0 km left", "1375 / 500 km" and "About 0 more weeks": the
 * overrun, which is the news, appeared nowhere, and the total had no
 * thousands separator where the rest of the app writes 1,247.
 */
export function shoeWearCopy(shoe: { totalKm: number; maxKm: number }): {
  over: boolean
  ratio: string
  /** "~120 km left", or "875 km over". */
  short: string
  /** "120 km left", or "875 km past its 500 km limit". */
  exact: string
} {
  const total = Math.round(shoe.totalKm)
  const limit = Math.round(shoe.maxKm)
  const over = limit > 0 && total > limit
  const left = formatKm(Math.max(0, limit - total))
  const overBy = formatKm(total - limit)

  return {
    over,
    ratio: t.shoes.kmOf(formatKm(total), formatKm(limit)),
    short: over ? t.shoes.kmOver(overBy) : t.shoes.kmLeft(left),
    exact: over ? t.shoes.pastLimit(overBy, formatKm(limit)) : t.shoes.kmLeftExact(left),
  }
}
