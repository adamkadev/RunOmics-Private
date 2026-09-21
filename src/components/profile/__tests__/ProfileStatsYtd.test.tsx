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

const prevYear: ProfilePeriodStats = {
  distanceKm: 1000,
  durationSeconds: 320000,
  sessionCount: 120,
  elevationGainM: 7000,
  avgKmPerWeek: 28.1,
  calories: 700000,
}

function cellsOf(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.grid > div'))
}

describe('ProfileStatsYtd', () => {
  it('gives every cell the same three-line structure so the rows align', () => {
    const { container } = render(
      <ProfileStatsYtd ytd={ytd} allTime={allTime} prevYear={prevYear} />
    )

    const cells = cellsOf(container)
    expect(cells).toHaveLength(6)
    for (const cell of cells) {
      expect(cell.children).toHaveLength(3)
    }
  })

  it('carries a year-on-year delta on every cell, not just distance', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYear={prevYear} />)

    expect(screen.getAllByText(t.profile.ytd.vsLastYear(PREV_YEAR))).toHaveLength(6)
    expect(screen.getByText('+205')).toBeInTheDocument()
    expect(screen.getByText('+11')).toBeInTheDocument()
    expect(screen.getByText('+20')).toBeInTheDocument()
    expect(screen.getByText('+1,200')).toBeInTheDocument()
    expect(screen.getByText('+4.3')).toBeInTheDocument()
  })

  it('keeps the structure but drops the comparison on the all-time period', async () => {
    const { container } = render(
      <ProfileStatsYtd ytd={ytd} allTime={allTime} prevYear={prevYear} />
    )

    await userEvent.click(screen.getByRole('tab', { name: t.profile.ytd.allTimeChip }))

    expect(screen.queryByText(t.profile.ytd.vsLastYear(PREV_YEAR))).not.toBeInTheDocument()
    expect(screen.getAllByText(t.profile.ytd.noComparison)).toHaveLength(6)
    for (const cell of cellsOf(container)) {
      expect(cell.children).toHaveLength(3)
    }
  })

  it('prints an em dash rather than a blank when there is no prior year', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYear={null} />)

    expect(screen.queryByText(t.profile.ytd.vsLastYear(PREV_YEAR))).not.toBeInTheDocument()
    expect(screen.getAllByText(t.profile.ytd.noComparison)).toHaveLength(6)
  })

  it('still shows the calories cell', () => {
    render(<ProfileStatsYtd ytd={ytd} allTime={allTime} prevYear={prevYear} />)

    expect(screen.getByText(t.profile.ytd.calories)).toBeInTheDocument()
  })
})
