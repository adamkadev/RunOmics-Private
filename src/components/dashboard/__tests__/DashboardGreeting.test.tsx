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

  // H06: past 6 h the sync age is a pill that syncs on tap; v4.3.4: muted
  // until the data is a day old.
  it('turns a sync older than 6 h into a tappable, muted pill', async () => {
    const lastSyncedAt = new Date(Date.now() - 23 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const pill = await screen.findByTestId('sync-pill')
    expect(pill.textContent).toContain(t.dashboard.syncStatus.tapToSync)
    expect(pill.getAttribute('style')).toContain('--muted-foreground')
    expect(pill.getAttribute('style')).not.toContain('--tone-caution')

    // Signed out: the tap goes to Settings, where the sync lives.
    await userEvent.click(pill)
    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('turns the pill amber once the last sync is over 24 h old', async () => {
    const lastSyncedAt = new Date(Date.now() - 30 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    const pill = await screen.findByTestId('sync-pill')
    expect(pill.getAttribute('style')).toContain('--tone-caution')
    expect(pill.hasAttribute('data-late')).toBe(true)
  })

  it('keeps a fresh sync as plain text', () => {
    const now = Date.parse('2026-09-26T08:00:00Z')
    expect(isSyncStale('2026-09-26T03:00:00Z', now)).toBe(false)
    expect(isSyncStale('2026-09-26T01:00:00Z', now)).toBe(true)
  })
})
