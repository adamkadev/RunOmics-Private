import { describe, expect, it } from 'vitest'
import { MONTH_LABEL_PX, positionMonthLabels, type MonthStart } from '@/lib/heatmapMonths'

const CELL = 11
const GAP = 2
const STEP = CELL + GAP

function lastCol(starts: MonthStart[]): number {
  return starts.reduce((max, m) => Math.max(max, m.col), 0)
}

/** A rolling 52-week window opening three columns into September. */
function rollingYear(openColumns = 3): MonthStart[] {
  const labels = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  let col = 0
  return labels.map((label, i) => {
    const start = { label, col }
    col += i === 0 ? openColumns : 4
    return start
  })
}

describe('positionMonthLabels', () => {
  it('places a label at its own column, not spread evenly', () => {
    const starts: MonthStart[] = [
      { label: 'Oct', col: 3 },
      { label: 'Nov', col: 7 },
      { label: 'Dec', col: 12 },
    ]
    const shown = positionMonthLabels(starts, 53, CELL, GAP)
    expect(shown.map(m => m.left)).toEqual([3 * STEP, 7 * STEP, 12 * STEP])
  })

  it('labels every month when they all fit', () => {
    const starts = rollingYear()
    const columns = lastCol(starts) + 3
    const shown = positionMonthLabels(starts, columns, CELL, GAP)
    // The opening sliver is 3 columns = 37px, wide enough to keep; the closing
    // one is 3 columns too. So all thirteen month starts survive.
    expect(shown).toHaveLength(starts.length)
    expect(shown.map(m => m.label)).toEqual(starts.map(m => m.label))
  })

  it('thins the row instead of dropping half the year when columns are narrow', () => {
    const starts = rollingYear()
    const columns = lastCol(starts) + 3
    const shown = positionMonthLabels(starts, columns, 5, 1)
    expect(shown.length).toBeGreaterThan(1)
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]!.left - shown[i - 1]!.left).toBeGreaterThanOrEqual(MONTH_LABEL_PX)
    }
    // Thinning skips columns, it never reorders them.
    const cols = shown.map(m => m.col)
    expect(cols).toEqual([...cols].sort((a, b) => a - b))
    expect(cols.every(c => starts.some(s => s.col === c))).toBe(true)
  })

  it('drops an opening sliver rather than letting it take the next month slot', () => {
    const starts: MonthStart[] = [
      { label: 'Sep', col: 0 },
      { label: 'Oct', col: 1 },
      { label: 'Nov', col: 5 },
    ]
    const shown = positionMonthLabels(starts, 53, CELL, GAP)
    expect(shown[0]).toEqual({ label: 'Oct', col: 1, left: STEP })
  })

  it('keeps an opening month that owns enough grid to carry its label', () => {
    const starts: MonthStart[] = [
      { label: 'Sep', col: 0 },
      { label: 'Oct', col: 3 },
    ]
    const shown = positionMonthLabels(starts, 53, CELL, GAP)
    expect(shown.map(m => m.label)).toEqual(['Sep', 'Oct'])
    expect(shown[0]!.left).toBe(0)
  })

  it('never positions a label past the right edge of the grid', () => {
    const columns = 53
    const gridWidth = columns * STEP - GAP
    const starts: MonthStart[] = [
      { label: 'Aug', col: 48 },
      { label: 'Sep', col: 52 },
    ]
    const shown = positionMonthLabels(starts, columns, CELL, GAP)
    // Sep owns one column (13px), too narrow for a label, so it is dropped
    // rather than shoved left onto August's weeks.
    expect(shown.map(m => m.label)).toEqual(['Aug'])
    for (const m of shown) {
      expect(m.left + MONTH_LABEL_PX).toBeLessThanOrEqual(gridWidth)
    }
  })

  it('returns nothing for an empty grid', () => {
    expect(positionMonthLabels([], 0, CELL, GAP)).toEqual([])
    expect(positionMonthLabels([{ label: 'Sep', col: 0 }], 0, CELL, GAP)).toEqual([])
  })

  it('keeps a lone month even when it is narrow', () => {
    const shown = positionMonthLabels([{ label: 'Sep', col: 0 }], 1, CELL, GAP)
    expect(shown).toEqual([{ label: 'Sep', col: 0, left: 0 }])
  })
})
