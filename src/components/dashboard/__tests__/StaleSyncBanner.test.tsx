import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatWeekdayTime } from '@/lib/formatters'
import { t } from '@/i18n'
import { StaleSyncBanner } from '../StaleSyncBanner'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()

describe('StaleSyncBanner', () => {
  it('says nothing while the data is less than a day old', async () => {
    render(<StaleSyncBanner lastSyncedAt={hoursAgo(23)} />)
    await waitFor(() => expect(screen.queryByTestId('stale-banner')).toBeNull())
  })

  it('names the age and the last sync once the data is a day behind', async () => {
    const last = hoursAgo(31)
    render(<StaleSyncBanner lastSyncedAt={last} />)
    const banner = await screen.findByTestId('stale-banner')

    expect(banner).toHaveTextContent(t.dashboard.stale.title(31))
    expect(banner).toHaveTextContent(t.dashboard.stale.line(formatWeekdayTime(last)))
    expect(banner.getAttribute('style')).toContain('var(--warn)')
  })

  // Signed out, the sync lives in Settings.
  it('offers a 44 pt sync that sends a visitor to Settings', async () => {
    render(<StaleSyncBanner lastSyncedAt={hoursAgo(31)} />)
    const sync = await screen.findByRole('button', { name: t.dashboard.stale.sync })

    expect(sync.className).toContain('hit-44')
    expect(sync.className).toContain('h-11')
    await userEvent.click(sync)
    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('draws nothing without a sync to report', () => {
    const { container } = render(<StaleSyncBanner lastSyncedAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
