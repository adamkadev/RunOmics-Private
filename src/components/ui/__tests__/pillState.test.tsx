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
 * language in on one picker of each former dialect: the neutral raised pill
 * (neutral surfaces), never an accent fill.
 */

const SELECTED = 'bg-[var(--segmented-pill)]'

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'


describe('the selected chip speaks one language', () => {
  it('marks the selected year with the neutral pill', () => {
    render(<YearSelector years={[2025, 2024]} selected={2025} onSelect={() => {}} />)

    const chip = screen.getByRole('button', { name: '2025' })
    expect(chip.className).toContain(SELECTED)
    expect(chip.className).not.toContain('bg-accent')
  })

  it('marks the selected segmented tab with the neutral pill', () => {
    function Tabs() {
      const tabs = useSegmentedTabs({ ids: ['year', 'allTime'] as const, value: 'year', onChange: () => {} })
      return <SegmentedTabs tabs={tabs} items={[{ id: 'year', label: 'This year' }, { id: 'allTime', label: 'All' }]} label="Period" />
    }
    render(<Tabs />)

    const selected = screen.getByRole('tab', { name: 'This year' })
    expect(selected.className).toContain(SELECTED)
    expect(selected.className).not.toContain('bg-accent')
    expect(selected.className).not.toContain(RETIRED_ACTIVE_TINT)

    const unselected = screen.getByRole('tab', { name: 'All' })
    expect(unselected.className).not.toContain(SELECTED)
  })

  it('marks the selected activity-type filter with the neutral pill', async () => {
    render(<ActivityListClient weekTarget={null} initialItems={[]} initialNextOffset={null} totalCount={0} today="2026-09-24" />)

    const all = screen.getByRole('button', { name: t.activities.all })
    expect(all.className).toContain(SELECTED)
    expect(all.className).not.toContain(RETIRED_ACTIVE_TINT)

    // The sort menu repeats some labels, so stay inside the filter row.
    const row = within(all.parentElement!)
    await userEvent.click(row.getByRole('button', { name: t.activityTypes.Tempo }))

    expect(row.getByRole('button', { name: t.activityTypes.Tempo }).className).toContain(SELECTED)
    expect(row.getByRole('button', { name: t.activities.all }).className).not.toContain(SELECTED)
  })
})
