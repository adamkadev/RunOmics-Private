'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { authorizedFetch } from '@/lib/ownerFetch'
import { clearStoredSince, readStoredSince, writeStoredSince } from '@/lib/syncSince'
import { t } from '@/i18n'

const POLL_INTERVAL_MS = 10_000

/** Only once the data is live: the verdict can take minutes, and nearly every answer until then is "still going". */
const POLL_BACKOFF = 1.25
const POLL_MAX_INTERVALS = 3

/** A hidden page asks nothing; the sync runs on without it. */
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

/** The chain (Garmin, a Vercel rebuild, ai-insights) takes about five minutes; the rest is slack for a queued runner or a slow build. */
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

/** Reads the run once its data is live, then again for its verdict, rather than leave yesterday's numbers up. */
export function useRefreshWhenLive(phase: Phase, refresh: (() => void) | undefined) {
  const live = phase.kind === 'done' ? 'verdict' : phase.kind === 'waiting' && phase.synced ? 'data' : null
  useEffect(() => {
    if (live) refresh?.()
  }, [live, refresh])
}

/** `pollIntervalMs` lets the tests, which run on real timers, skip the ten-second wait. */
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
      // The same answer again comes back as an empty 304.
      let etag: string | null = null
      let live = false

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
          // Synced, but the newest run's card predates it: nothing new came in.
          if (status.synced && status.reason === 'verdict predates this sync') {
            clearStoredSince()
            setPhase({ kind: 'upToDate' })
            return 'done'
          }
          live = status.synced
          setPhase({ kind: 'waiting', synced: status.synced })
          return 'continue'
        } catch {
          // A dropped poll costs one interval; the next one asks again.
          return 'continue'
        }
      }

      // A resumed poll asks once right away, even past the deadline, rather than assume a timeout.
      if (resuming) {
        if (cancelled.current) return
        if ((await checkOnce()) === 'done') return
      }

      let wait = pollIntervalMs
      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, wait))
        if (live) wait = Math.min(wait * POLL_BACKOFF, pollIntervalMs * POLL_MAX_INTERVALS)
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
    // The sync outlives this component: stop polling on unmount, resume from storage on mount.
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
      // 429: held back by the server's limits, not a failure.
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
