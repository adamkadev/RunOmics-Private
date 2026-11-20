import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityListClient } from '@/components/activities/ActivityListClient'
import { t } from '@/i18n'
import type { ActivitySummary } from '@/domain/activity/types'

vi.mock('next/navigation', async (actual) => ({ ...(await actual<typeof import('next/navigation')>()), useRouter: () => ({ prefetch: () => {} }) }))

const CHIP_SELECTED = 'bg-foreground'

const RETIRED_ACTIVE_TINT = 'bg-foreground/[0.14]'

const tempo: ActivitySummary = {
  id: 'a', date: '2026-09-20', dayOfWeek: 'Sunday', type: 'Tempo', description: 'Run a', comment: '',
  distanceKm: 10, durationSeconds: 3000, paceSecPerKm: 300, avgHeartRate: null, zones: [], routeThumb: null,
}


describe('the selected chip speaks one language', () => {
  it('marks the selected activity group inverted', async () => {
    window.history.replaceState(null, '', '/activities')
    render(<ActivityListClient initialItems={[tempo]} totalCount={1} today="2026-09-24" map={{ version: 'v', clusterId: null }} />)

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
