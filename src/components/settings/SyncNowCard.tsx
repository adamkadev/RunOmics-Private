'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { authorizedFetch } from '@/lib/ownerFetch'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const POLL_INTERVAL_MS = 10_000

/**
 * Twelve minutes. The chain measures about five - Garmin, a Vercel rebuild,
 * then the ai-insights pass - and the slack is for a queued runner or a slow
 * build. Past that the run is still going; it just finishes without us.
 */
const POLL_CEILING_MS = 12 * 60_000

/**
 * The one thing this card cannot lose by leaving the page: which sync it is
 * waiting on. `phase` is plain component state, gone the moment Settings
 * unmounts - and closing Settings mid-sync used to be the normal way to use
 * it, on a phone, while it fetched. Coming back showed idle with nothing to
 * suggest a sync was already running, which invited pressing the button again
 * and dispatching a second one. This is the one fact worth surviving that:
 * not the whole phase (a stale "Fetching…" is fine to rebuild from scratch),
 * just the timestamp a resumed poll needs to ask the right question again.
 */
const STORAGE_KEY = 'runomics_sync_since'

function readStoredSince(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredSince(since: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, since)
  } catch {
    // Worst case, a page reload mid-sync shows idle again - the sync itself
    // is unaffected, it just runs without a card watching it.
  }
}

function clearStoredSince(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to reclaim if this fails - the key can only ever hold one sync.
  }
}

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

export function SyncNowCard({ user }: { user: User }) {
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
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        if (cancelled.current) return
        if ((await checkOnce()) === 'done') return
      }

      if (!cancelled.current) {
        clearStoredSince()
        setPhase({ kind: 'timedOut' })
      }
    },
    [authorized]
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

  const s = t.settings.sync
  const running = phase.kind === 'starting' || phase.kind === 'waiting'
  const progress = progressText(phase, s)

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="flex items-center gap-3.5">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-accent/[0.14]">
          <RefreshCw size={18} className={cn('text-accent', running && 'animate-spin')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {progress ?? s.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={running}
          className="shrink-0 text-footnote font-semibold text-accent-text transition-opacity active:opacity-60 disabled:opacity-40"
        >
          {running ? s.starting : s.action}
        </button>
      </div>

      {phase.kind === 'done' && phase.status.verdict && (
        <>
          <div className="my-4 h-px bg-foreground/[0.06]" />
          <div>
            <p className="text-sm font-semibold leading-snug text-foreground">
              {phase.status.verdict.headline}
            </p>
            <p className="mt-1 text-caption leading-snug text-muted-foreground">
              {phase.status.verdict.body}
            </p>
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
      )}

      {phase.kind === 'idle' && (
        <p className="mt-3 text-caption leading-snug text-subtle">{s.takesAbout}</p>
      )}
    </GlassSurface>
  )
}
