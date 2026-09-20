import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { SyncNowCard } from '@/components/settings/SyncNowCard'
import { t } from '@/i18n'

const STORAGE_KEY = 'runomics_sync_since'
const s = t.settings.sync

const USER = { getIdToken: () => Promise.resolve('test-token') } as unknown as User

const VERDICT_STATUS = {
  ready: true,
  synced: true,
  activity: { id: 'a1', name: 'Easy run', distance: '7.7 km', duration: '44:27', url: '/activities/a1' },
  verdict: { headline: 'Held together to the last rep', body: 'Only two seconds a kilometre of fade.' },
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body }
}

/** Never a literal: the card polls until `since + POLL_CEILING_MS` on the real clock. */
function dispatchedJustNow(): string {
  return new Date().toISOString()
}

function renderCard() {
  return render(<SyncNowCard user={USER} />)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SyncNowCard', () => {
  it('renders idle with nothing to resume', () => {
    renderCard()
    expect(screen.getByText(s.action)).toBeInTheDocument()
    expect(screen.getByText(s.takesAbout)).toBeInTheDocument()
  })

  it('stores the dispatch timestamp so the button click survives a remount', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const since = dispatchedJustNow()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ since }))
      .mockResolvedValue(jsonResponse({ ...VERDICT_STATUS, ready: false, reason: 'no verdict for this run yet' }))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()
    await user.click(screen.getByText(s.action))

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(since))
  })

  it('does not persist anything when the dispatch itself fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'not configured' }, false)))

    renderCard()
    await user.click(screen.getByText(s.action))

    await waitFor(() => expect(screen.getByText(s.failed)).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('shows the verdict and clears storage once a poll comes back ready', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ since: dispatchedJustNow() }))
      .mockResolvedValue(jsonResponse(VERDICT_STATUS))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()
    await user.click(screen.getByText(s.action))
    await vi.advanceTimersByTimeAsync(10_000)

    await waitFor(() => expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('resumes a sync left running when the card remounts, without waiting a poll interval first', async () => {
    // The regression this whole file exists for: leaving Settings mid-sync and
    // coming back used to show idle, with nothing to say a sync was already
    // running - inviting a second dispatch. A fresh mount with a stored
    // timestamp must ask immediately, not wait out a full interval first.
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...VERDICT_STATUS, ready: false, synced: false, reason: 'waiting for the deployment carrying this sync' }))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()

    expect(screen.getByText(s.starting)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toMatch('/api/sync/status')
  })

  it('still asks once, rather than assuming a timeout, when reopened well past the ceiling', async () => {
    const longAgo = new Date(Date.now() - 20 * 60_000).toISOString()
    localStorage.setItem(STORAGE_KEY, longAgo)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...VERDICT_STATUS, ready: false, reason: 'no verdict for this run yet' }))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()

    await waitFor(() => expect(screen.getByText(s.stillRunning)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('resumes straight into the verdict when the sync finished while the card was gone', async () => {
    localStorage.setItem(STORAGE_KEY, new Date(Date.now() - 4 * 60_000).toISOString())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(VERDICT_STATUS)))

    renderCard()

    await waitFor(() => expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('reports the run brought nothing new, and clears storage, once synced with no fresh verdict', async () => {
    localStorage.setItem(STORAGE_KEY, new Date(Date.now() - 4 * 60_000).toISOString())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ ready: false, synced: true, reason: 'verdict predates this sync', activity: null, verdict: null })
      )
    )

    renderCard()

    await waitFor(() => expect(screen.getByText(s.upToDate)).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
