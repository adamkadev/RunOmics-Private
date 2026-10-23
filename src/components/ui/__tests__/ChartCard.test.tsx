import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isoDate } from '@/lib/calendarDate'
import { WindowedChartCard } from '@/components/ui/ChartWindowNav'
import { t } from '@/i18n'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

describe('WindowedChartCard: reading and footnote', () => {
  it('leads with the reading and keeps the definition behind the (i)', async () => {
    const user = userEvent.setup()

    render(
      <WindowedChartCard
        title="Avg Heart Rate"
        points={[{ date: daysAgo(3) }, { date: daysAgo(2) }, { date: daysAgo(1) }]}
        footnote="Duration-weighted average HR."
        reading={() => 'Easy HR is drifting down.'}
      >
        {() => <div data-testid="chart" />}
      </WindowedChartCard>
    )

    const reading = screen.getByText(/Easy HR is drifting down\./)
    expect(reading.tagName).toBe('P')
    expect(reading.className).toContain('text-footnote')
    expect(reading.textContent).toBe('Easy HR is drifting down.')
    expect(reading.compareDocumentPosition(screen.getByTestId('chart'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    expect(screen.queryByText('Duration-weighted average HR.')).not.toBeInTheDocument()

    const disclosure = screen.getByRole('button', { name: t.analytics.aboutChart })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')

    await user.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Duration-weighted average HR.')).toBeInTheDocument()

    await user.click(disclosure)
    expect(screen.queryByText('Duration-weighted average HR.')).not.toBeInTheDocument()
  })

  it('offers no disclosure when the card has no definition to disclose', () => {
    render(
      <WindowedChartCard title="Zone Distribution" points={[{ date: daysAgo(1) }]}>
        {() => <div data-testid="chart" />}
      </WindowedChartCard>
    )

    expect(screen.queryByRole('button', { name: t.analytics.aboutChart })).not.toBeInTheDocument()
  })

  it('reads the visible window, not the whole series', () => {
    const seen: string[][] = []

    render(
      <WindowedChartCard
        title="Weekly Volume"
        points={[{ date: daysAgo(200) }, { date: daysAgo(5) }, { date: daysAgo(4) }, { date: daysAgo(3) }]}
        sample={false}
        reading={(visible) => {
          seen.push(visible.map((p) => p.date))
          return `${visible.length} weeks`
        }}
      >
        {() => <div data-testid="chart" />}
      </WindowedChartCard>
    )

    // The default 4-week window keeps a 200-day-old point out of the reading, or it would contradict the chart.
    expect(seen.at(-1)).toEqual([daysAgo(5), daysAgo(4), daysAgo(3)])
    expect(screen.getByText('3 weeks')).toBeInTheDocument()
  })

  it('says nothing rather than reading an empty window', () => {
    render(
      <WindowedChartCard
        title="Weekly Volume"
        points={[{ date: daysAgo(200) }]}
        reading={() => 'this should never render'}
      >
        {() => <div data-testid="chart" />}
      </WindowedChartCard>
    )

    expect(screen.queryByText(/this should never render/)).not.toBeInTheDocument()
    expect(screen.getByText(t.chartWindow.empty)).toBeInTheDocument()
  })
})

describe('WindowedChartCard: sparse windows', () => {
  it('prints the value instead of plotting a two-point trend', () => {
    render(
      <WindowedChartCard
        title="Running Form"
        points={[{ date: daysAgo(8) }, { date: daysAgo(1) }]}
        sample={false}
        reading={() => 'cadence is climbing'}
        value={() => '176 spm'}
      >
        {() => <div data-testid="chart" />}
      </WindowedChartCard>
    )

    expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
    expect(screen.getByText('176 spm')).toBeInTheDocument()
    expect(screen.getByText(t.chartWindow.tooFewToPlot)).toBeInTheDocument()
    expect(screen.queryByText(/cadence is climbing/)).not.toBeInTheDocument()
  })

  it('plots a sparse window, and says each point is a weekly mean', () => {
    render(
      <WindowedChartCard
        title="Running Form"
        points={[{ date: daysAgo(21) }, { date: daysAgo(14) }, { date: daysAgo(7) }]}
        sample={false}
      >
        {(visible, shape) => <div data-testid="chart" data-shape={shape} data-points={visible.length} />}
      </WindowedChartCard>
    )

    const chart = screen.getByTestId('chart')
    expect(chart).toHaveAttribute('data-shape', 'sparse')
    expect(screen.queryByText(/complete week/)).not.toBeInTheDocument()
  })

  it('drops the cadence footnote once the window is dense enough to draw', () => {
    render(
      <WindowedChartCard
        title="Training Load"
        points={Array.from({ length: 14 }, (_, i) => ({ date: daysAgo(14 - i) }))}
        sample={false}
      >
        {(_visible, shape) => <div data-testid="chart" data-shape={shape} />}
      </WindowedChartCard>
    )

    expect(screen.getByTestId('chart')).toHaveAttribute('data-shape', 'curve')
    expect(screen.queryByText(/in this window/)).not.toBeInTheDocument()
  })
})
