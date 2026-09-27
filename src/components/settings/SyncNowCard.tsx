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

      async function checkOnce(): Promise<'done' | 'continue'> {
        try {
          const response = await authorized(`/api/sync/status?since=${encodeURIComponent(since)}`)
          if (!response.ok) return 'continue'

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

      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
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
      if (!response.ok) throw new Error(`dispatch failed with ${response.status}`)
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

/** The device row's action: "Sync now", spinning while the chain runs. */
export function SyncNowButton({ sync }: { sync: SyncNow }) {
  const s = t.settings.sync
  return (
    <button
      type="button"
      onClick={sync.handleSync}
      disabled={sync.running}
      className="flex shrink-0 items-center gap-1.5 text-footnote font-semibold text-accent-text transition-opacity active:opacity-60 disabled:opacity-40"
    >
      {sync.running && <RefreshCw size={14} className="animate-spin" aria-hidden />}
      {sync.running ? s.starting : s.action}
    </button>
  )
}

/** What the last sync brought in: its verdict and a link to the run. */
export function SyncVerdict({ sync }: { sync: SyncNow }) {
  const s = t.settings.sync
  const { phase } = sync
  if (phase.kind !== 'done' || !phase.status.verdict) return null
  return (
    <>
      <div className="my-4 h-px bg-foreground/[0.06]" />
      <div>
        <p className="text-sm font-semibold leading-snug text-foreground">{phase.status.verdict.headline}</p>
        <p className="mt-1 text-caption leading-snug text-muted-foreground">{phase.status.verdict.body}</p>
        {phase.status.activity && (
          <Link
            href={`/activities/${phase.status.activity.id}`}
            className="mt-2.5 inline-flex items-center gap-2 text-footnote font-semibold text-accent-text transition-opacity active:opacity-60"
          >
            <span className="text-muted-foreground">
              {phase.status.activity.distance} · {phase.status.activity.duration}
            </span>
            {s.viewRun}
          </Link>
        )}
      </div>
    </>
  )
}
