import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { t } from '@/i18n'

const CHIP_SELECTED = 'bg-foreground'

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'


describe('the selected chip speaks one language', () => {
  it('marks the selected activity group inverted', async () => {
    window.history.replaceState(null, '', '/activities')
    render(<ActivityListClient initialItems={[]} totalCount={0} today="2026-09-24" map={{ version: 'v', clusterId: null }} />)

    const all = screen.getByRole('button', { name: t.activities.all })
    expect(all.className).toContain(CHIP_SELECTED)
    expect(all.className).not.toContain(RETIRED_ACTIVE_TINT)

    const row = within(all.parentElement!)
    await userEvent.click(row.getByRole('button', { name: t.activities.groups.workouts }))

    expect(row.getByRole('button', { name: t.activities.groups.workouts }).className).toContain(CHIP_SELECTED)
    expect(row.getByRole('button', { name: t.activities.all }).className).not.toContain(CHIP_SELECTED)
    window.history.replaceState(null, '', '/')
  })
})
