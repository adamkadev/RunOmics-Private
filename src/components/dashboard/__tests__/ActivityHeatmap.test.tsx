import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { MONTH_LABEL_PX } from '@/lib/heatmapMonths'
import type { HeatmapDay } from '@/application/usecases/GetHeatmapData'

/** The window getHeatmapData builds: a Monday, then 364 rolling days. */
const WINDOW_START = '2025-09-15'
const WINDOW_DAYS = 367

function rollingWindow(): HeatmapDay[] {
  const cursor = new Date(WINDOW_START + 'T12:00:00')
  const days: HeatmapDay[] = []
  for (let i = 0; i < WINDOW_DAYS; i++) {
    days.push({
      date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
      distanceKm: i % 3 === 0 ? 10 : 0,
      sessionCount: i % 3 === 0 ? 1 : 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/**
 * The cell size is measured, so the layout only exists if the container reports
 * a width. 700px lands on an 11px cell with a 2px gap - the phone case.
 */
const WIDTH = 700
const STEP = 11 + 2

let clientWidth: PropertyDescriptor | undefined

beforeAll(() => {
  clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => WIDTH })
})

afterAll(() => {
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
})

function monthRow(container: HTMLElement): HTMLSpanElement[] {
  return Array.from(container.querySelectorAll<HTMLSpanElement>('span.absolute'))
}

describe('ActivityHeatmap month labels', () => {
  it('positions a label over the column its month opens on', () => {
    const { container } = render(<ActivityHeatmap days={rollingWindow()} />)
    // Weeks run Sep 15, Sep 22, Sep 29, Oct 6 - October opens on column 3.
    const oct = monthRow(container).find(el => el.textContent === 'Oct')
    expect(oct).toBeDefined()
    expect(oct!.style.left).toBe(`${3 * STEP}px`)
  })

  it('labels every month that fits, not every second one', () => {
    const { container } = render(<ActivityHeatmap days={rollingWindow()} />)
    // A rolling year has 12 or 13 month starts; the old row showed about six.
    expect(monthRow(container).length).toBeGreaterThanOrEqual(11)
  })

  it('never lets two labels collide', () => {
    const { container } = render(<ActivityHeatmap days={rollingWindow()} />)
    const lefts = monthRow(container).map(el => parseFloat(el.style.left))
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]! - lefts[i - 1]!).toBeGreaterThanOrEqual(MONTH_LABEL_PX)
    }
  })

  it('names the rolling window as a range, since it straddles new year', () => {
    render(<ActivityHeatmap days={rollingWindow()} />)
    expect(screen.getByText(/Sep 2025/)).toBeInTheDocument()
    expect(screen.getByText(/Sep 2025/).textContent).toMatch(/Sep 2026/)
  })

  it('renders without a month row when there are no days', () => {
    const { container } = render(<ActivityHeatmap days={[]} />)
    expect(monthRow(container)).toHaveLength(0)
  })
})
