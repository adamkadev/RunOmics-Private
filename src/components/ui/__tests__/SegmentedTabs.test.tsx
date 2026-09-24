import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { ProfileStatsYtd } from '@/components/profile/ProfileStatsYtd'
import { t } from '@/i18n'

const stats: ProfilePeriodStats = {
  distanceKm: 1205,
  durationSeconds: 360000,
  sessionCount: 140,
  elevationGainM: 8200,
  avgKmPerWeek: 32.4,
  calories: 812000,
}

function renderTabs() {
  render(<ProfileStatsYtd ytd={stats} allTime={stats} prevYear={stats} year={2026} />)
  return {
    year: screen.getByRole('tab', { name: t.profile.ytd.thisYearChip }),
    allTime: screen.getByRole('tab', { name: t.profile.ytd.allTimeChip }),
  }
}

// The tablists had no keyboard support beyond Tab reaching every button, and
// no panel for a screen reader to land on.
describe('segmented tabs', () => {
  it('keeps only the selected tab in the Tab order', () => {
    const { year, allTime } = renderTabs()

    expect(year).toHaveAttribute('tabindex', '0')
    expect(allTime).toHaveAttribute('tabindex', '-1')
  })

  it('moves with the arrow keys, selecting and focusing as it goes', async () => {
    const user = userEvent.setup()
    const { year, allTime } = renderTabs()

    year.focus()
    await user.keyboard('{ArrowRight}')
    expect(allTime).toHaveAttribute('aria-selected', 'true')
    expect(allTime).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(year).toHaveAttribute('aria-selected', 'true')
    expect(year).toHaveFocus()

    await user.keyboard('{End}')
    expect(allTime).toHaveFocus()
  })

  it('ties the selected tab to the panel it shows', () => {
    const { year } = renderTabs()

    const panel = screen.getByRole('tabpanel')
    expect(year).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', year.id)
  })
})
