import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileStatsYtd } from '@/components/profile/ProfileStatsYtd'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { t } from '@/i18n'

const PREV_YEAR = new Date().getFullYear() - 1

const ytd: ProfilePeriodStats = {
  distanceKm: 1205,
  durationSeconds: 360000,
  sessionCount: 140,
  elevationGainM: 8200,
  avgKmPerWeek: 32.4,
  calories: 812000,
}

const allTime: ProfilePeriodStats = { ...ytd, distanceKm: 4822, sessionCount: 512 }

function cellsOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.grid > div'))
}

describe('ProfileStatsYtd', () => {
  it('gives every cell the same three-line structure so the rows align', () => {
    const { container } = render(
      <ProfileStatsYtd ytd={ytd} allTime={allTime} prevYearDistanceKm={1000} />
    )

    const cells = cellsOf(container)
    expect(cells).toHaveLength(6)
    for (const cell of cells) {
      expect(cell.children).toHaveLength(3)
    }
  })

  it('carries the year-on-year delta on distance, signed and coloured', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYearDistanceKm={1000} />)

    expect(screen.getByText('+205')).toBeInTheDocument()
    expect(screen.getByText(t.profile.ytd.vsLastYear(PREV_YEAR))).toBeInTheDocument()
  })

  it('keeps the structure but drops the comparison on the all-time period', async () => {
    const { container } = render(
      <ProfileStatsYtd ytd={ytd} allTime={allTime} prevYearDistanceKm={1000} />
    )

    await userEvent.click(screen.getByRole('button', { name: t.profile.ytd.allTimeChip }))

    expect(screen.queryByText(t.profile.ytd.vsLastYear(PREV_YEAR))).not.toBeInTheDocument()
    for (const cell of cellsOf(container)) {
      expect(cell.children).toHaveLength(3)
    }
  })

  it('shows no comparison at all when there is no prior year to compare against', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYearDistanceKm={0} />)

    expect(screen.queryByText(t.profile.ytd.vsLastYear(PREV_YEAR))).not.toBeInTheDocument()
  })

  it('still shows the calories cell', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYearDistanceKm={1000} />)

    expect(screen.getByText(t.profile.ytd.calories)).toBeInTheDocument()
  })
})
