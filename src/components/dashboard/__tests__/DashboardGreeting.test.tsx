import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting, headerDate, isSyncStale } from '../DashboardGreeting'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

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

  /** A pull down from the top of the page, far enough to sync. */
  function pull(distance = 200) {
    fireEvent.touchStart(window, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(window, { touches: [{ clientY: distance }] })
    fireEvent.touchEnd(window)
  }

  // Wave 5 A0 (App Fixes 1a): no ↻ button in the header; a pull refreshes.
  it('has no sync button, only its note beside the avatar', async () => {
    const lastSyncedAt = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const s = t.dashboard.syncStatus
    const note = await screen.findByTestId('sync-note')
    expect(note.getAttribute('aria-label')).toBe(s.synced(s.hoursAgo(2)))
    expect(note.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reads the data again on a pull when signed out, and turns amber once a day old', async () => {
    const { unmount } = render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    await screen.findByTestId('sync-note')
    pull()
    expect(refresh).toHaveBeenCalled()
    unmount()

    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 30 * 3600_000).toISOString()} />)
    expect((await screen.findByTestId('sync-note')).dataset.tone).toBe('caution')
  })

  it('starts the owner\'s sync on a pull, and shows its words while it runs', async () => {
    owner.signedIn = true
    const s = t.dashboard.syncStatus
    const lastSyncedAt = new Date(Date.now() - 14 * 3600_000).toISOString()
    const { rerender } = render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    await screen.findByTestId('sync-note')
    pull(40)
    expect(owner.handleSync).not.toHaveBeenCalled()
    pull()
    expect(owner.handleSync).toHaveBeenCalled()

    owner.phase = { kind: 'starting' }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(screen.getByRole('status').textContent).toBe(s.syncing)
    expect(screen.getByTestId('pull-indicator').querySelector('svg')!.getAttribute('class')).toContain('animate-spin')

    owner.phase = { kind: 'failed' }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(screen.getByTestId('sync-note').textContent).toBe(s.failed)
    expect(screen.getByTestId('sync-note').dataset.tone).toBe('caution')
  })

  // Deliberate pulls only (it fired by accident).
  it('needs 100 px of pull, 200 px of finger, and shows the ring growing before release', async () => {
    refresh.mockClear()
    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    await screen.findByTestId('sync-note')
    fireEvent.touchStart(window, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(window, { touches: [{ clientX: 0, clientY: 120 }] })
    const ring = screen.getByTestId('pull-indicator')
    expect(ring.dataset.ready).toBeUndefined()
    fireEvent.touchMove(window, { touches: [{ clientX: 0, clientY: 199 }] })
    // Released short of the trigger: nothing.
    fireEvent.touchEnd(window)
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.queryByTestId('pull-indicator')).toBeNull()

    fireEvent.touchStart(window, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(window, { touches: [{ clientX: 0, clientY: 200 }] })
    expect(screen.getByTestId('pull-indicator').dataset.ready).toBe('true')
    fireEvent.touchEnd(window)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('cancels a pull more than 30° off vertical', async () => {
    refresh.mockClear()
    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    await screen.findByTestId('sync-note')
    fireEvent.touchStart(window, { touches: [{ clientX: 0, clientY: 0 }] })
    // 40° off vertical: a swipe, cancelled for the rest of the touch.
    fireEvent.touchMove(window, { touches: [{ clientX: 50, clientY: 60 }] })
    fireEvent.touchMove(window, { touches: [{ clientX: 50, clientY: 240 }] })
    fireEvent.touchEnd(window)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not arm while a scroll is still moving at the top', async () => {
    refresh.mockClear()
    render(<DashboardGreeting name="Adam" lastSyncedAt={new Date(Date.now() - 23 * 3600_000).toISOString()} />)
    await screen.findByTestId('sync-note')
    fireEvent.scroll(window)
    pull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps a fresh sync as plain text', () => {
    const now = Date.parse('2026-09-26T08:00:00Z')
    expect(isSyncStale('2026-09-26T03:00:00Z', now)).toBe(false)
    expect(isSyncStale('2026-09-26T01:00:00Z', now)).toBe(true)
  })
})
