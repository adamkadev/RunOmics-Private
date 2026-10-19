import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting, headerDate, isSyncStale } from '../DashboardGreeting'

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
    // The disc is 40 pt; hit-44 grows its target without growing the row.
    expect(link.className).toContain('hit-44')
    expect(link.className).toContain('size-10')
  })

  // Design review, Oct 2026 (mock 1b): the date over the title, which the
  // compact bar fades with it.
  it('writes the date over the title', () => {
    // A client render reads the reader's clock (useToday).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 19, 12))
    render(<DashboardGreeting name="Adam" today="2026-10-19" />)
    vi.useRealTimers()
    const date = screen.getByTestId('today-date')
    expect(date.textContent).toBe(headerDate('2026-10-19'))
    expect(date.textContent).toBe('Monday, Oct 19')
    expect(date.hasAttribute('data-title-sub')).toBe(true)
  })

  // The sync line is the sync control at any age, 44 pt tall, beside the avatar.
  it('carries the sync line beside the avatar, tappable at any age', async () => {
    const lastSyncedAt = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const line = await screen.findByTestId('sync-line')
    expect(line.tagName).toBe('BUTTON')
    expect(line.className).toContain('min-h-11')
    expect(line.textContent).toBe(t.dashboard.syncStatus.synced(t.dashboard.syncStatus.hoursAgo(2)))
    expect(line.parentElement!.contains(screen.getByRole('link', { name: t.nav.items.profile }))).toBe(true)

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
