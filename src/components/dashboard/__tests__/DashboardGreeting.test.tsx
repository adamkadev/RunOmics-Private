import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting, headerDate, isSyncStale } from '../DashboardGreeting'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

// Signed out unless a test signs the owner in, with the sync in the phase it sets.
const owner = vi.hoisted(() => ({ signedIn: false, phase: { kind: 'idle' } as { kind: string }, handleSync: vi.fn() }))
vi.mock('@/lib/useOwnerAuth', () => ({
  useOwnerAuth: () => (owner.signedIn ? { user: {}, isOwner: true, loading: false } : { user: null, isOwner: false, loading: false }),
}))
vi.mock('@/components/settings/SyncNowCard', () => ({
  useSyncNow: () => ({ phase: owner.phase, running: false, progress: null, handleSync: owner.handleSync }),
}))

describe('DashboardGreeting', () => {
  afterEach(() => {
    owner.signedIn = false
    owner.phase = { kind: 'idle' }
  })

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

  // 3.0.2 (mock 5f): sync is a round ↻ button beside the avatar, tappable at
  // any age; its words are its name at rest, not a line on screen.
  it('carries the sync button beside the avatar, tappable at any age', async () => {
    const lastSyncedAt = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const s = t.dashboard.syncStatus
    const button = await screen.findByRole('button', { name: s.synced(s.hoursAgo(2)) })
    expect(button).toBe(screen.getByTestId('sync-line'))
    expect(button.className).toContain('size-10')
    expect(button.className).toContain('rounded-full')
    expect(button.className).toContain('hit-44')
    expect(button.textContent).toBe('')
    expect(screen.getByTestId('sync-note').textContent).toBe('')
    expect(button.parentElement!.parentElement!.contains(screen.getByRole('link', { name: t.nav.items.profile }))).toBe(true)

    // Signed out: the tap goes to Settings, where signing in lives.
    await userEvent.click(button)
    expect(push).toHaveBeenCalledWith('/settings')
  })

  // H06 and v4.3.4: past 6 h its name says it can be tapped, amber once a day old.
  it('offers the sync past 6 h, muted, and turns amber once the data is a day old', async () => {
    const { unmount } = render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    const button = await screen.findByTestId('sync-line')
    expect(button.getAttribute('aria-label')).toContain(t.dashboard.syncStatus.tapToSync)
    expect(button.getAttribute('style')).toContain('--muted-foreground')
    unmount()

    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 30 * 3600_000).toISOString()} />)
    const late = await screen.findByTestId('sync-line')
    expect(late.dataset.tone).toBe('caution')
    expect(late.getAttribute('style')).toContain('--tone-caution')
  })

  // The owner's press starts the sync; its words come on screen while it runs.
  it('shows the sync’s words beside the button once pressed, and turns the arrows while it runs', async () => {
    owner.signedIn = true
    const s = t.dashboard.syncStatus
    const lastSyncedAt = new Date(Date.now() - 14 * 3600_000).toISOString()
    const { rerender } = render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    const button = await screen.findByRole('button', { name: `${s.synced(s.hoursAgo(14))} · ${s.tapToSync}` })
    expect(screen.getByTestId('sync-note').textContent).toBe('')
    await userEvent.click(button)
    expect(owner.handleSync).toHaveBeenCalled()

    owner.phase = { kind: 'starting' }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    const running = screen.getByTestId('sync-line')
    expect(running).toBeDisabled()
    expect(running.getAttribute('aria-label')).toBe(s.syncing)
    expect(running.querySelector('svg')!.getAttribute('class')).toContain('animate-spin')
    expect(screen.getByRole('status').textContent).toBe(s.syncing)

    owner.phase = { kind: 'failed' }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(screen.getByTestId('sync-note').textContent).toBe(s.failed)
    expect(screen.getByTestId('sync-line').dataset.tone).toBe('caution')
  })

  it('keeps a fresh sync as plain text', () => {
    const now = Date.parse('2026-09-26T08:00:00Z')
    expect(isSyncStale('2026-09-26T03:00:00Z', now)).toBe(false)
    expect(isSyncStale('2026-09-26T01:00:00Z', now)).toBe(true)
  })
})
