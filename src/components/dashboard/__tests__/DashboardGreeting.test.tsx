import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'
import { DashboardGreeting, headerDate, isSyncStale } from '../DashboardGreeting'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

// Signed out unless a test signs the owner in, with the sync in the phase it sets.
const owner = vi.hoisted(() => ({ signedIn: false, phase: { kind: 'idle' } as { kind: string; synced?: boolean }, handleSync: vi.fn() }))
vi.mock('@/lib/useOwnerAuth', () => ({
  useOwnerAuth: () => (owner.signedIn ? { user: {}, isOwner: true, loading: false } : { user: null, isOwner: false, loading: false }),
}))
vi.mock('@/components/settings/SyncNowCard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/settings/SyncNowCard')>()),
  useSyncNow: () => ({ phase: owner.phase, running: false, progress: null, handleSync: owner.handleSync }),
}))

describe('DashboardGreeting', () => {
  afterEach(() => {
    owner.signedIn = false
    owner.phase = { kind: 'idle' }
  })

  it('heads the page with its title', () => {
    render(<DashboardGreeting name="Adam" />)
    expect(screen.getByRole('heading', { level: 1, name: t.pages.dashboard.title })).toBeInTheDocument()
  })

  it('makes the avatar a 44 pt link to Progress', () => {
    render(<DashboardGreeting name="Adam" />)
    const link = screen.getByRole('link', { name: t.nav.items.profile })

    expect(link).toHaveAttribute('href', '/profile')
    // The disc is 32 pt in its capsule; hit-44 grows its target without growing the row.
    expect(link.className).toContain('hit-44')
    expect(link.className).toContain('size-8')
    expect(screen.getByTestId('today-capsule').contains(link)).toBe(true)
  })

  // data-title-sub: the compact bar fades the date with the title.
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

  it('carries the sync button beside the avatar, tappable at any age', async () => {
    const lastSyncedAt = new Date(Date.now() - 2 * 3600_000).toISOString()
    render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)

    const s = t.dashboard.syncStatus
    const button = await screen.findByRole('button', { name: s.synced(s.hoursAgo(2)) })
    expect(button).toBe(screen.getByTestId('sync-line'))
    // The ↻ alone in the capsule's first 44 pt.
    expect(button.className).toContain('size-11')
    expect(button.className).toContain('rounded-full')
    expect(button.textContent).toBe('')
    expect(screen.getByTestId('sync-note').textContent).toBe('')
    // One 44 pt glass capsule with the avatar, the sync's words outside it.
    const capsule = screen.getByTestId('today-capsule')
    expect(capsule.className).toMatch(/(^|\s)lg(\s|$)/)
    // The glass layers first, then the ↻.
    expect([...capsule.children].filter((c) => c.tagName === 'I').map((i) => i.className)).toEqual(['lg-blur', 'lg-edge', 'lg-tint'])
    expect([...capsule.children].find((c) => c.tagName !== 'I')).toBe(button)
    expect(capsule.contains(screen.getByRole('link', { name: t.nav.items.profile }))).toBe(true)
    expect(capsule.contains(screen.getByTestId('sync-note'))).toBe(false)

    // Signed out: the tap goes to Settings, where signing in lives.
    await userEvent.click(button)
    expect(push).toHaveBeenCalledWith('/settings')
  })

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

  it('reads the run as soon as its data is live, and again once its verdict lands', () => {
    owner.signedIn = true
    owner.phase = { kind: 'waiting', synced: false }
    const lastSyncedAt = new Date(Date.now() - 14 * 3600_000).toISOString()
    const { rerender } = render(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(refresh).not.toHaveBeenCalled()

    owner.phase = { kind: 'waiting', synced: true }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(refresh).toHaveBeenCalledTimes(1)

    owner.phase = { kind: 'done' }
    rerender(<DashboardGreeting name="Adam" lastSyncedAt={lastSyncedAt} />)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('keeps a fresh sync as plain text', () => {
    const now = Date.parse('2026-09-26T08:00:00Z')
    expect(isSyncStale('2026-09-26T03:00:00Z', now)).toBe(false)
    expect(isSyncStale('2026-09-26T01:00:00Z', now)).toBe(true)
  })
})
