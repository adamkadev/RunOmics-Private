import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isoDate } from '@/lib/calendarDate'
import { TrainingStatusHistoryChart } from '@/components/analytics/TrainingStatusHistoryChart'
import type { TrainingStatusHistoryPoint } from '@/application/usecases/GetTrainingStatusHistory'
import { t } from '@/i18n'

const s = t.analytics.charts.trainingStatusHistory

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

function dayLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(t.locale, {
    day: 'numeric',
    month: 'short',
  })
}

// Fourteen consecutive rated days inside the default four-week window: ten
// Productive, then four Recovery. Two segments, so two ribbon buttons and two
// distribution rows, and a 71/29 split of the rated days.
const POINTS: TrainingStatusHistoryPoint[] = Array.from({ length: 14 }, (_, i) => ({
  date: daysAgo(14 - i),
  label: daysAgo(14 - i),
  status: i < 10 ? ('productive' as const) : ('recovery' as const),
  acuteLoad: 400 + i,
  chronicLoad: 410 + i,
  targetBand: [300, 200],
}))

describe('Training Status: distribution, ribbon and load legend', () => {
  it('ranks the statuses by share instead of wrapping them as dots', () => {
    const { container } = render(<TrainingStatusHistoryChart data={{ points: POINTS }} />)

    // The counts are the card's content - the reading is computed from them -
    // so they get a labelled block of ranked rows, not a run of 11px dots.
    const eyebrow = screen.getByText(s.distribution)
    const block = eyebrow.parentElement
    expect(block).not.toBeNull()

    const values = screen.getAllByText(new RegExp(`^\\d+ ${s.daysUnit} · \\d+%$`))
    expect(values.map((v) => v.textContent)).toEqual([
      `10 ${s.daysUnit} · 71%`,
      `4 ${s.daysUnit} · 29%`,
    ])

    // Each row is a filled track, so the dominant share is visible without
    // reading either number. The fills are the only inline-styled <div>s in
    // the block; the status labels are <span>s.
    const widths = Array.from(block!.querySelectorAll<HTMLElement>('div[style]')).map((fill) =>
      parseFloat(fill.style.width),
    )
    expect(widths).toHaveLength(2)
    expect(widths[0]).toBeGreaterThan(widths[1]!)
    expect(widths[0]! + widths[1]!).toBeCloseTo(100, 6)

    // The old legend printed the raw day count with no share and no track.
    expect(
      screen.queryByText(`${t.trainingStatus.status.productive} · 10`),
    ).not.toBeInTheDocument()

    // The accessible summary names the same shares that are drawn.
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      `${t.trainingStatus.status.productive} 10 ${s.daysUnit} (71%)`,
    )

    // The definition stays behind the (i) - it is not ink until asked for.
    expect(screen.queryByText(s.footnote)).not.toBeInTheDocument()
    expect(container.querySelector('.h-2.flex-1')).not.toBeNull()
  })

  it('draws the ribbon at 24px and names the days it starts and ends on', () => {
    const { container } = render(<TrainingStatusHistoryChart data={{ points: POINTS }} />)

    const ribbon = container.querySelector('.h-6')
    expect(ribbon).not.toBeNull()
    expect(ribbon!.querySelectorAll('button')).toHaveLength(2)

    // The strip had no axis of any kind. Its bounds are the first and last
    // *rated* day drawn, not the window's, because unrated days are dropped
    // rather than drawn.
    const bounds = ribbon!.nextElementSibling
    expect(bounds?.textContent).toContain(dayLabel(daysAgo(14)))
    expect(bounds?.textContent).toContain(dayLabel(daysAgo(1)))
  })

  it('names the two plotted lines with their current values', () => {
    render(<TrainingStatusHistoryChart data={{ points: POINTS }} />)

    // chronicLoad/acuteLoad of the last visible day: 423 and 413.
    expect(screen.getByText(`${s.chronic} 423`)).toBeInTheDocument()
    expect(screen.getByText(`${s.acute} 413`)).toBeInTheDocument()
  })
})
