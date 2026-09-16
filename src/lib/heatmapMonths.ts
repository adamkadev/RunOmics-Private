/**
 * The consistency heatmap is a grid of week columns, so a month label only
 * means something if it sits over the column its month opens on. The old row
 * computed that column and then threw it away - it reached the DOM as part of a
 * React key while the row itself was `flex justify-between`, which spreads the
 * labels evenly no matter which months they name. Even spacing happens to be
 * close at the left edge and drifts further with every column, so the label
 * over the most recent weeks - the end anyone actually reads - was off by more
 * than a month.
 *
 * positionMonthLabels turns the month starts into absolute pixel offsets
 * measured from the grid's left edge, so `left` is the label's real position.
 * Two rules keep the row readable at any cell size:
 *
 * - A month narrower than a label cannot carry one at its true position. At the
 *   left edge the window opens mid-month, and a two-column sliver would sit in
 *   the slot that belongs to the next month; at the right edge the label would
 *   run past the last column. Both edges get dropped rather than nudged, since
 *   a nudged label names the wrong weeks. The header's date range still names
 *   both ends of the window.
 * - When the grid is narrow enough that neighbouring months would collide, the
 *   row thins itself, keeping labels in order and never closer than one label
 *   width. This replaces a blind `i % 2 === 0`, which dropped half the year
 *   even when all twelve fitted.
 */

/** Room for a 3-4 character abbreviated month at --text-micro (10px), plus a gutter. */
export const MONTH_LABEL_PX = 26

export interface MonthStart {
  /** Abbreviated month name, already localised. */
  label: string
  /** Index of the week column the month opens on. */
  col: number
}

export interface PositionedMonth extends MonthStart {
  /** Pixels from the grid's left edge to the label's left edge. */
  left: number
}

export function positionMonthLabels(
  starts: MonthStart[],
  columns: number,
  cellSize: number,
  gap: number,
): PositionedMonth[] {
  const step = cellSize + gap
  if (!starts.length || columns <= 0 || step <= 0) return []

  // A month spanning n columns is n cells and n-1 gaps wide.
  const spanPx = starts.map((m, i) => ((starts[i + 1]?.col ?? columns) - m.col) * step - gap)
  const tooNarrow = (i: number) => (spanPx[i] ?? 0) < MONTH_LABEL_PX

  let first = 0
  let last = starts.length - 1
  if (last > first && tooNarrow(first)) first += 1
  if (last > first && tooNarrow(last)) last -= 1

  const shown: PositionedMonth[] = []
  for (const month of starts.slice(first, last + 1)) {
    const left = month.col * step
    const prev = shown[shown.length - 1]
    if (prev && left - prev.left < MONTH_LABEL_PX) continue
    shown.push({ label: month.label, col: month.col, left })
  }
  return shown
}
