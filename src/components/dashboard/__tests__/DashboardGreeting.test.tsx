import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting, isSyncStale } from '../DashboardGreeting'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('DashboardGreeting', () => {
  // v4.17: Today has a page header like every page - the H1 and its line.
  it('heads the page with its title', () => {
    render(<DashboardGreeting name="Adam" />)
    expect(screen.getByRole('heading', { level: 1, name: t.pages.dashboard.title })).toBeInTheDocument()
  })

  // The avatar looked tappable and was a plain div.
  it('makes the avatar a 44 pt link to Progress', () => {
    render(<DashboardGreeting name="Adam" />)
    const link = screen.getByRole('link', { name: t.nav.items.profile })

    expect(link).toHaveAttribute('href', '/profile')
    // The disc is 34 pt; hit-44 grows its target without growing the row.
    expect(link.className).toContain('hit-44')
    expect(link.className).toContain('size-8.5')
  })

  // Design review, Oct 2026: no date (Today and every session say it), and
  // the sync line is the sync control at any age, 44 pt tall.
  it('carries the sync line under the title, tappable at any age, without the date', async () => {
    const lastSyncedAt = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const line = await screen.findByTestId('sync-line')
    expect(line.tagName).toBe('BUTTON')
    expect(line.className).toContain('min-h-11')
    expect(line.textContent).toBe(t.dashboard.syncStatus.synced(t.dashboard.syncStatus.hoursAgo(2)))
    expect(screen.getByTestId('today-header').textContent).not.toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /)

    // Signed out: the tap goes to Settings, where signing in lives.
    await userEvent.click(line)
    expect(push).toHaveBeenCalledWith('/settings')
  })

  // H06 and v4.3.4: past 6 h it says it can be tapped, amber once a day old.
  it('offers the sync past 6 h, muted, and turns amber once the data is a day old', async () => {
    const { unmount } = render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    const line = await screen.findByTestId('sync-line')
    expect(line.textContent).toContain(t.dashboard.syncStatus.tapToSync)
    expect(line.getAttribute('style')).toContain('--muted-foreground')
    unmount()

    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 30 * 3600_000).toISOString()} />)
    const late = await screen.findByTestId('sync-line')
    expect(late.dataset.tone).toBe('caution')
    expect(late.getAttribute('style')).toContain('--tone-caution')
  })

  it('keeps a fresh sync as plain text', () => {
    const now = Date.parse('2026-09-26T08:00:00Z')
    expect(isSyncStale('2026-09-26T03:00:00Z', now)).toBe(false)
    expect(isSyncStale('2026-09-26T01:00:00Z', now)).toBe(true)
  })
})
