import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearSelector } from '@/components/ui/YearSelector'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { t } from '@/i18n'

/**
 * "Selected" used to be said two ways: the accent fill on the year and window
 * pickers, and a neutral 14 % foreground tint (`Pill` variant `active`) on the
 * Activities filter row and the profile period toggle. These lock the single
 * language in - the accent fill - on one picker of each former dialect.
 */

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'


describe('the selected chip speaks one language', () => {
  it('fills the selected year with the accent', () => {
    render(<YearSelector years={[2025, 2024]} selected={2025} onSelect={() => {}} />)

    const chip = screen.getByRole('button', { name: '2025' })
    expect(chip.className).toContain('bg-accent')
  })

  it('fills the selected segmented tab with the accent, not a neutral tint', () => {
    function Tabs() {
      const tabs = useSegmentedTabs({ ids: ['year', 'allTime'] as const, value: 'year', onChange: () => {} })
      return <SegmentedTabs tabs={tabs} items={[{ id: 'year', label: 'This year' }, { id: 'allTime', label: 'All' }]} label="Period" />
    }
    render(<Tabs />)

    const selected = screen.getByRole('tab', { name: 'This year' })
    expect(selected.className).toContain('bg-accent')
    expect(selected.className).not.toContain(RETIRED_ACTIVE_TINT)

    const unselected = screen.getByRole('tab', { name: 'All' })
    expect(unselected.className).not.toContain('bg-accent')
  })

  it('fills the selected activity-type filter with the accent, not a neutral tint', async () => {
    render(<ActivityListClient weekTarget={null} initialItems={[]} initialNextOffset={null} totalCount={0} today="2026-09-24" />)

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
