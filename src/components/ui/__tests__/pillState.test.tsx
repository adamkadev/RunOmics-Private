import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearSelector } from '@/components/ui/YearSelector'
import { ProfileStatsYtd } from '@/components/profile/ProfileStatsYtd'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { t } from '@/i18n'

/**
 * "Selected" used to be said two ways: the accent fill on the year and window
 * pickers, and a neutral 14 % foreground tint (`Pill` variant `active`) on the
 * Activities filter row and the profile period toggle. These lock the single
 * language in - the accent fill - on one picker of each former dialect.
 */

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'

const stats: ProfilePeriodStats = {
  distanceKm: 1205,
  durationSeconds: 360000,
  sessionCount: 140,
  elevationGainM: 8200,
  avgKmPerWeek: 32.4,
  calories: 812000,
}

describe('the selected chip speaks one language', () => {
  it('fills the selected year with the accent', () => {
    render(<YearSelector years={[2025, 2024]} selected={2025} onSelect={() => {}} />)

    const chip = screen.getByRole('button', { name: '2025' })
    expect(chip.className).toContain('bg-accent')
  })

  it('fills the selected profile period with the accent, not a neutral tint', () => {
    render(<ProfileStatsYtd ytd={stats} allTime={stats} prevYearDistanceKm={1000} />)

    const selected = screen.getByRole('button', { name: t.profile.ytd.thisYearChip })
    expect(selected.className).toContain('bg-accent')
    expect(selected.className).not.toContain(RETIRED_ACTIVE_TINT)

    const unselected = screen.getByRole('button', { name: t.profile.ytd.allTimeChip })
    expect(unselected.className).not.toContain('bg-accent')
  })

  it('fills the selected activity-type filter with the accent, not a neutral tint', async () => {
    render(<ActivityListClient initialItems={[]} initialNextOffset={null} totalCount={0} />)

    const all = screen.getByRole('button', { name: t.activities.all })
    expect(all.className).toContain('bg-accent')
    expect(all.className).not.toContain(RETIRED_ACTIVE_TINT)

    // The sort menu repeats some labels, so stay inside the filter row.
    const row = within(all.parentElement!)
    await userEvent.click(row.getByRole('button', { name: t.activityTypes.Tempo }))

    expect(row.getByRole('button', { name: t.activityTypes.Tempo }).className).toContain('bg-accent')
    expect(row.getByRole('button', { name: t.activities.all }).className).not.toContain('bg-accent')
  })
})
