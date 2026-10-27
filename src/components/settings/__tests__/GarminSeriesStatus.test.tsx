import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GarminSeriesStatus } from '@/components/settings/GarminSeriesStatus'
import { seriesFreshness } from '@/domain/sync/seriesFreshness'
import { t } from '@/i18n'

const d = t.settings.diagnostics.garminSeries
const NOW = Date.parse('2026-10-27T08:00:00Z')

describe('GarminSeriesStatus', () => {
  it('counts the series that stopped and, opened, says since when and which requests failed', async () => {
    const series = seriesFreshness({ trainingStatus: '2026-10-19', restingHr: '2026-10-26' }, NOW)
    render(<GarminSeriesStatus series={series} warningSteps={['training status']} warningCount={2} />)

    const toggle = screen.getByRole('button', { name: new RegExp(d.title) })
    expect(toggle.textContent).toContain(d.stopped(1))
    await userEvent.click(toggle)

    const stale = screen.getAllByTestId('garmin-series').filter((row) => row.dataset.stale)
    expect(stale).toHaveLength(1)
    expect(stale[0]!.textContent).toContain(d.names.trainingStatus)
    expect(screen.getByTestId('garmin-warnings').textContent).toBe(d.warnings(2, 'training status'))
  })

  it('reads all current, and a series the watch never filled as never received rather than stopped', async () => {
    const series = seriesFreshness({ restingHr: '2026-10-26', trainingStatus: null }, NOW)
    render(<GarminSeriesStatus series={series} warningSteps={[]} warningCount={0} />)

    const toggle = screen.getByRole('button', { name: new RegExp(d.title) })
    expect(toggle.textContent).toContain(d.allCurrent)
    await userEvent.click(toggle)
    expect(screen.getAllByTestId('garmin-series').find((row) => row.textContent?.includes(d.names.trainingStatus))!.textContent).toContain(d.never)
    expect(screen.queryByTestId('garmin-warnings')).toBeNull()
  })

  it('stays out of the way before any sync dated a series', () => {
    const { container } = render(<GarminSeriesStatus series={seriesFreshness({}, NOW)} warningSteps={[]} warningCount={0} />)
    expect(container.firstChild).toBeNull()
  })
})
