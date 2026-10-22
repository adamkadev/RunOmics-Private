'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { authorizedFetch } from '@/lib/ownerFetch'
import { clearStoredSince, readStoredSince, writeStoredSince } from '@/lib/syncSince'
import { t } from '@/i18n'

const POLL_INTERVAL_MS = 10_000

/**
 * Each wait a quarter longer than the last, up to three intervals (design
 * review, Oct 2026): nearly every answer in the chain's five minutes is
 * "still going", and asking every ten seconds throughout bought nothing.
 */
const POLL_BACKOFF = 1.25
const POLL_MAX_INTERVALS = 3

/**
 * Resolves once the page is in front. A page in the background asks nothing -
 * the run goes on without it - and the first look back asks at once.
 */
function whenVisible(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return Promise.resolve()
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') return
      document.removeEventListener('visibilitychange', onChange)
      resolve()
    }
    document.addEventListener('visibilitychange', onChange)
  })
}

/**
 * Twelve minutes. The chain measures about five - Garmin, a Vercel rebuild,
 * then the ai-insights pass - and the slack is for a queued runner or a slow
 * build. Past that the run is still going; it just finishes without us.
 */
const POLL_CEILING_MS = 12 * 60_000

interface VerdictStatus {
  ready: boolean
  synced: boolean
  reason?: string
  activity: { id: string; name: string; distance: string; duration: string; url: string } | null
  verdict: { headline: string; body: string } | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'waiting'; synced: boolean }
  | { kind: 'done'; status: VerdictStatus }
  | { kind: 'upToDate' }
  | { kind: 'timedOut' }
  | { kind: 'failed' }
  /** The server held the sync back: synced moments ago, or the day's syncs used up. */
  | { kind: 'limited'; reason: 'cooldown' | 'dailyCap'; retryAfterSec: number }

function progressText(phase: Phase, s: typeof t.settings.sync): string | null {
  switch (phase.kind) {
    case 'starting':
      return s.starting
    case 'waiting':
      return phase.synced ? s.writing : s.fetching
    case 'upToDate':
      return s.upToDate
    case 'timedOut':
      return s.stillRunning
    case 'failed':
      return s.failed
    case 'limited':
      return phase.reason === 'dailyCap' ? s.dailyCap : s.cooldown(Math.ceil(phase.retryAfterSec / 60))
    default:
      return null
  }
}

/**
 * The Garmin sync, as state (v5.6 #6: it lives on the device row now, not a
 * card of its own). `pollIntervalMs` exists for the tests, which drive this
 * loop on real timers (see the test file for why fake ones deadlock
 * `userEvent`) and would otherwise each sit through a genuine ten-second wait.
 */
export function useSyncNow(user: User, pollIntervalMs = POLL_INTERVAL_MS) {
  const [phase, setPhase] = useState<Phase>(() => (readStoredSince() ? { kind: 'waiting', synced: false } : { kind: 'idle' }))
  const cancelled = useRef(false)

  const authorized = useCallback(
    (path: string, init?: RequestInit) => authorizedFetch(user, path, init),
    [user]
  )

  const pollForVerdict = useCallback(
    async (since: string, resuming: boolean) => {
      const deadline = Date.parse(since) + POLL_CEILING_MS
      // The last answer's tag: the same answer again comes back as an empty 304.
      let etag: string | null = null

      async function checkOnce(): Promise<'done' | 'continue'> {
        try {
          const response = await authorized(
            `/api/sync/status?since=${encodeURIComponent(since)}`,
            etag ? { headers: { 'if-none-match': etag } } : undefined
          )
          // A 304 is the answer unchanged: the chain is still moving.
          if (!response.ok) return 'continue'
          etag = response.headers.get('etag')

          const status = (await response.json()) as VerdictStatus
          if (status.ready) {
            clearStoredSince()
            setPhase({ kind: 'done', status })
            return 'done'
          }
          // The app is live on this sync and the newest run still holds a
          // card written before it: nothing new came in, so there is nothing
          // to wait for. Every other reason is the chain still moving.
          if (status.synced && status.reason === 'verdict predates this sync') {
            clearStoredSince()
            setPhase({ kind: 'upToDate' })
            return 'done'
          }
          setPhase({ kind: 'waiting', synced: status.synced })
          return 'continue'
        } catch {
          // A dropped poll costs one interval; the next one asks again.
          return 'continue'
        }
      }

      // A resumed poll asks immediately, deadline or not: the wait it is
      // resuming into may already be over by the time Settings is reopened,
      // and a page reopened well past the ceiling still deserves one real
      // answer instead of an assumed timeout the loop below would otherwise
      // hand out without ever asking.
      if (resuming) {
        if (cancelled.current) return
        if ((await checkOnce()) === 'done') return
      }

      let wait = pollIntervalMs
      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, wait))
        wait = Math.min(wait * POLL_BACKOFF, pollIntervalMs * POLL_MAX_INTERVALS)
        await whenVisible()
        if (cancelled.current) return
        if ((await checkOnce()) === 'done') return
      }

      if (!cancelled.current) {
        clearStoredSince()
        setPhase({ kind: 'timedOut' })
      }
    },
    [authorized, pollIntervalMs]
  )

  useEffect(() => {
    // A sync left running when Settings closes must not keep polling on a
    // card that is gone - but the sync itself, and the fact that one is
    // running, both outlive this component. Resume it rather than forget it.
    cancelled.current = false
    const since = readStoredSince()
    if (since) void pollForVerdict(since, true)
    return () => {
      cancelled.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, deliberately not per authorized identity
  }, [])

  async function handleSync() {
    setPhase({ kind: 'starting' })

    let since: string
    try {
      const response = await authorized('/api/sync/dispatch', { method: 'POST' })
      // Held back by the server's limits (design review, Oct 2026): not a
      // failure, and nothing to wait on - say when the next one can go.
      if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as { reason?: string; retryAfter?: number }
        setPhase({ kind: 'limited', reason: body.reason === 'dailyCap' ? 'dailyCap' : 'cooldown', retryAfterSec: body.retryAfter ?? 60 })
        return
      }
      if (!response.ok) throw new Error(`dispatch failed with ${response.status}`)
      // A run already going comes back as its own start: wait on it as on ours.
      since = ((await response.json()) as { since: string }).since
    } catch (error) {
      console.error('Sync dispatch failed:', error)
      setPhase({ kind: 'failed' })
      return
    }

    writeStoredSince(since)
    await pollForVerdict(since, false)
  }

  const running = phase.kind === 'starting' || phase.kind === 'waiting'
  return { phase, running, progress: progressText(phase, t.settings.sync), handleSync }
}

export type SyncNow = ReturnType<typeof useSyncNow>

/**
 * The device row's action (3.0 1i): "Sync" as a text link in the accent on
 * the row's right, not a full-width button; "Syncing…" with its spinner
 * while the chain runs, and the device line says which step.
 */
export function SyncNowButton({ sync }: { sync: SyncNow }) {
  const s = t.settings.sync
  return (
    <button
      type="button"
      onClick={sync.handleSync}
      disabled={sync.running}
      className="hit-44 inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-text transition-opacity active:opacity-60 disabled:text-muted-foreground"
    >
      {sync.running && <RefreshCw size={13} className="animate-spin" aria-hidden />}
      {sync.running ? s.running : s.action}
    </button>
  )
}

/** What the last sync brought in: its verdict and a link to the run. */
export function SyncVerdict({ sync }: { sync: SyncNow }) {
  const s = t.settings.sync
  const { phase } = sync
  if (phase.kind !== 'done' || !phase.status.verdict) return null
  return (
    <div className="px-4 py-3" data-testid="sync-verdict">
      <p className="text-sm font-semibold leading-snug text-foreground">{phase.status.verdict.headline}</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{phase.status.verdict.body}</p>
      {phase.status.activity && (
        <Link
          href={`/activities/${phase.status.activity.id}`}
          className="mt-2.5 inline-flex items-center gap-2 text-[13px] font-medium text-accent-text transition-opacity active:opacity-60"
        >
          <span className="text-muted-foreground">
            {phase.status.activity.distance} · {phase.status.activity.duration}
          </span>
          {s.viewRun}
        </Link>
      )}
    </div>
  )
}
