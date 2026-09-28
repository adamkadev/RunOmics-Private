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
 * Activities filter row and the profile period toggle. These lock the v4.17
 * languages in, one per control, and keep the accent out of both - it is for
 * the athlete's own data and real actions:
 * - a chip is inverted: text ink, with the page ground as its label;
 * - a tab is lifted onto the card surface, in text ink.
 */

const CHIP_SELECTED = 'bg-foreground'
const TAB_SELECTED = 'bg-[var(--segmented-pill)]'
const ACCENT_FILL = 'bg-accent'

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'


describe('the selected chip speaks one language', () => {
  it('marks the selected year inverted, not in the accent', () => {
    render(<YearSelector years={[2025, 2024]} selected={2025} onSelect={() => {}} />)

    const chip = screen.getByRole('button', { name: '2025' })
    expect(chip.className).toContain(CHIP_SELECTED)
    expect(chip.className).toContain('text-background')
    expect(chip.className).not.toContain(ACCENT_FILL)
  })

  it('lifts the selected segmented tab onto the card, not into the accent', () => {
    function Tabs() {
      const tabs = useSegmentedTabs({ ids: ['year', 'allTime'] as const, value: 'year', onChange: () => {} })
      return <SegmentedTabs tabs={tabs} items={[{ id: 'year', label: 'This year' }, { id: 'allTime', label: 'All' }]} label="Period" />
    }
    render(<Tabs />)

    const selected = screen.getByRole('tab', { name: 'This year' })
    expect(selected.className).toContain(TAB_SELECTED)
    expect(selected.className).toContain('text-foreground')
    expect(selected.className).not.toContain(ACCENT_FILL)
    expect(selected.className).not.toContain(RETIRED_ACTIVE_TINT)

    const unselected = screen.getByRole('tab', { name: 'All' })
    expect(unselected.className).not.toContain(TAB_SELECTED)
  })

  it('marks the selected activity-type filter inverted', async () => {
    render(<ActivityListClient weekTarget={null} initialItems={[]} initialNextOffset={null} totalCount={0} today="2026-09-24" />)

    const all = screen.getByRole('button', { name: t.activities.all })
    expect(all.className).toContain(CHIP_SELECTED)
    expect(all.className).not.toContain(RETIRED_ACTIVE_TINT)

    // The sort menu repeats some labels, so stay inside the filter row.
    const row = within(all.parentElement!)
    await userEvent.click(row.getByRole('button', { name: t.activityTypes.Tempo }))

    expect(row.getByRole('button', { name: t.activityTypes.Tempo }).className).toContain(CHIP_SELECTED)
    expect(row.getByRole('button', { name: t.activities.all }).className).not.toContain(CHIP_SELECTED)
  })
})
