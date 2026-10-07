import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { DataSourceInfo } from '@/components/settings/DataSourceInfo'
import { t } from '@/i18n'

const STORAGE_KEY = 'runomics_sync_since'
const s = t.settings.sync

// Real time, deliberately: `userEvent.click` deadlocks under fake timers
// (React's own `act()` flushing needs setTimeout/MessageChannel to actually
// fire on their own, and nothing outside the awaited click can advance a fake
// clock while the click itself is what's being awaited), and switching to
// fake timers partway through a test left a poll iteration waiting on a real
// timer a fake-clock advance afterward can't touch. The two tests below that
// wait a genuine poll interval hand the card a short one instead of sitting
// through production's ten seconds - long enough that a dispatch's stored
// timestamp is still observable before the first poll clears it, short enough
// not to dominate the suite. Only those two override it: the fake-timer tests
// keep the real interval, so that `runAllTimersAsync` still drains the poll
// loop in the few dozen iterations the twelve-minute ceiling allows at 10s
// rather than the thousands it would take at a few hundred milliseconds.
const REAL_POLL_INTERVAL_MS = 500
const CLICK_TEST_TIMEOUT_MS = 5_000

const USER = { getIdToken: () => Promise.resolve('test-token') } as unknown as User

const VERDICT_STATUS = {
  ready: true,
  synced: true,
  activity: { id: 'a1', name: 'Easy run', distance: '7.7 km', duration: '44:27', url: '/activities/a1' },
  verdict: { headline: 'Held together to the last rep', body: 'Only two seconds a kilometre of fade.' },
}

function jsonResponse(body: unknown, ok = true, etag?: string) {
  return { ok, status: ok ? 200 : 503, headers: new Headers(etag ? { etag } : {}), json: async () => body }
}

function renderCard(pollIntervalMs?: number) {
  // The sync lives on the Garmin card's device row (v5.6 #6).
  return render(<DataSourceInfo lastSyncedAt={null} activityCount={0} user={USER} pollIntervalMs={pollIntervalMs} />)
}

/**
 * Advancing the fake clock by 0ms still walks its queue and, on the way, lets
 * every pending microtask (a mocked fetch's promise chain, in every test that
 * uses this) settle - the standard way to flush "nothing left to do yet"
 * under fake timers without waiting on real wall-clock time.
 *
 * `@testing-library`'s own `waitFor` is not used for these: it polls on a
 * real interval, and once fake timers are active that real interval never
 * fires. It is used further down, in the two tests that stay on real timers
 * throughout, where it works exactly as documented.
 */
async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(async () => {
  // A resumed-poll test that doesn't drive its loop to a terminal state
  // leaves it running past its own end - and the next test's fetch/
  // localStorage stubs are still there to answer it. Draining every pending
  // fake timer here forces every such loop closed before those stubs change
  // out from under it. A no-op for the two tests that never install fake
  // timers at all.
  if (vi.isFakeTimers()) await vi.runAllTimersAsync()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Sync now, on the Garmin card', () => {
  it('renders idle with nothing to resume', () => {
    renderCard()
    expect(screen.getByText(s.action)).toBeInTheDocument()
    expect(screen.getByTestId('sync-line').textContent).toBe(s.subtitle)
    // One Garmin card: the sync has no card of its own.
    expect(screen.getAllByTestId('garmin-row')).toHaveLength(1)
  })

  it(
    'stores the dispatch timestamp so the button click survives a remount',
    async () => {
      const since = new Date().toISOString()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ since }))
        .mockResolvedValue(jsonResponse(VERDICT_STATUS))
      vi.stubGlobal('fetch', fetchMock)

      renderCard(REAL_POLL_INTERVAL_MS)
      const user = userEvent.setup()
      await user.click(screen.getByText(s.action))

      await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(since))

      // Let the poll's one real interval pass so the loop reaches its own
      // natural end rather than leaking past this test.
      await waitFor(() => expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument(), {
        timeout: REAL_POLL_INTERVAL_MS + 2_000,
      })
    },
    CLICK_TEST_TIMEOUT_MS
  )

  it('does not persist anything when the dispatch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'not configured' }, false)))

    renderCard()
    const user = userEvent.setup()
    await user.click(screen.getByText(s.action))

    await waitFor(() => expect(screen.getByText(s.failed)).toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // Design review, Oct 2026: held back by the server's limits is not a failure.
  it('says when the next sync can go when the server holds one back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ reason: 'cooldown', retryAfter: 290 }) }))

    renderCard()
    const user = userEvent.setup()
    await user.click(screen.getByText(s.action))

    await waitFor(() => expect(screen.getByText(s.cooldown(5))).toBeInTheDocument())
    expect(screen.queryByText(s.failed)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('says the day is used up when the daily cap is reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ reason: 'dailyCap', retryAfter: 3600 }) }))

    renderCard()
    const user = userEvent.setup()
    await user.click(screen.getByText(s.action))

    await waitFor(() => expect(screen.getByText(s.dailyCap)).toBeInTheDocument())
  })

  it(
    'shows the verdict and clears storage once a poll comes back ready',
    async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ since: new Date().toISOString() }))
        .mockResolvedValue(jsonResponse(VERDICT_STATUS))
      vi.stubGlobal('fetch', fetchMock)

      renderCard(REAL_POLL_INTERVAL_MS)
      const user = userEvent.setup()
      await user.click(screen.getByText(s.action))

      await waitFor(() => expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument(), {
        timeout: REAL_POLL_INTERVAL_MS + 2_000,
      })
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    },
    CLICK_TEST_TIMEOUT_MS
  )

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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    renderCard()
    // v4.17: the button says it is syncing; the device line says which step.
    expect(screen.getByText(s.running)).toBeInTheDocument()
    expect(screen.getByTestId('sync-line').textContent).toBe(s.fetching)

    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toMatch('/api/sync/status')
  })

  it('still asks once, rather than assuming a timeout, when reopened well past the ceiling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const longAgo = new Date(Date.now() - 20 * 60_000).toISOString()
    localStorage.setItem(STORAGE_KEY, longAgo)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...VERDICT_STATUS, ready: false, reason: 'no verdict for this run yet' }))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()
    await settle()

    expect(screen.getByText(s.stillRunning)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('resumes straight into the verdict when the sync finished while the card was gone', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    localStorage.setItem(STORAGE_KEY, new Date(Date.now() - 4 * 60_000).toISOString())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(VERDICT_STATUS)))

    renderCard()
    await settle()

    expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('reports the run brought nothing new, and clears storage, once synced with no fresh verdict', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    localStorage.setItem(STORAGE_KEY, new Date(Date.now() - 4 * 60_000).toISOString())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ ready: false, synced: true, reason: 'verdict predates this sync', activity: null, verdict: null })
      )
    )

    renderCard()
    await settle()

    expect(screen.getByText(s.upToDate)).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

// Design review, Oct 2026: fewer questions while the chain runs.
describe('Sync now, while it waits', () => {
  const STILL_GOING = { ...VERDICT_STATUS, ready: false, synced: false, reason: 'waiting for the deployment carrying this sync' }


  it('waits a little longer before each question, up to half a minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const start = Date.now()
    localStorage.setItem(STORAGE_KEY, new Date(start).toISOString())
    const times: number[] = []
    const fetchMock = vi.fn(async () => {
      times.push(Date.now() - start)
      return jsonResponse(STILL_GOING)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderCard()
    await settle(150_000)

    // Asked at once on resume, then 10 s, 12.5 s, 15.6 s... apart, never more than 30 s.
    const gaps = times.slice(1).map((at, i) => at - times[i]!)
    expect(gaps.slice(0, 3)).toEqual([10_000, 12_500, 15_625])
    expect(Math.max(...gaps)).toBe(30_000)
  })

  it('asks nothing while the page is in the background', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(STILL_GOING))
    vi.stubGlobal('fetch', fetchMock)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    renderCard()
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await settle(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    visibility.mockRestore()
  })

  it('sends the last answer’s tag, and reads a 304 as still going', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(STILL_GOING, true, '"abc"'))
      .mockResolvedValueOnce({ ok: false, status: 304, headers: new Headers({ etag: '"abc"' }), json: async () => ({}) })
      .mockResolvedValue(jsonResponse(VERDICT_STATUS, true, '"def"'))
    vi.stubGlobal('fetch', fetchMock)

    renderCard()
    await settle()
    await settle(10_000)
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ 'if-none-match': '"abc"' })
    expect(screen.getByTestId('sync-line').textContent).toBe(s.fetching)

    await settle(12_500)
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByText(VERDICT_STATUS.verdict.headline)).toBeInTheDocument()
  })
})
