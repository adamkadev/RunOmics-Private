'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RotateCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { initials, formatDate, formatRelativeAgo, formatWeekdayLong } from '@/lib/formatters'
import { appTodayIso } from '@/lib/calendarDate'
import { useMounted } from '@/lib/useMounted'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { useToday } from '@/lib/useToday'
import { SYNC_LIMITS } from '@/lib/syncLimits'
import { useSyncNow } from '@/components/settings/SyncNowCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  name?: string
  lastSyncedAt?: string | null
  /** The date the page was prerendered on, which the header writes; see useToday. */
  today?: string
}

/** Past this the sync button's name says it can be tapped. */
export const STALE_SYNC_MS = 6 * 3600_000

/** Past this the data is a day behind: the line turns amber (v4.3.4). */
export const LATE_SYNC_MS = 24 * 3600_000

export function isSyncStale(lastSyncedAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastSyncedAt) > STALE_SYNC_MS
}

export function isSyncLate(lastSyncedAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastSyncedAt) > LATE_SYNC_MS
}

/** How long ago the data synced, in ms: read after mount, as every age here is. */
export function syncAgeMs(lastSyncedAt: string, now = Date.now()): number {
  return now - Date.parse(lastSyncedAt)
}

/** Under this, a sync has just run: a tap says when the next can go, and asks GitHub for nothing. */
const FRESH_SYNC_MS = SYNC_LIMITS.cooldownAfterSuccessMs

/** How far a pull at the top of the page has to travel before it syncs. */
const PULL_TRIGGER_PX = 70

interface Line {
  text: string
  tone: 'muted' | 'accent' | 'caution'
  spinning?: boolean
  disabled?: boolean
  /** The words on screen beside the avatar: while a sync runs or has just answered, never at rest. */
  shown?: boolean
  onClick: () => void
}

const NOTHING = () => {}

/**
 * Pull-to-refresh (App Fixes 1a, Wave 5 A0): the header's ↻ button is gone,
 * and a pull down from the top of Today runs what it ran. A ring follows the
 * finger and turns while the sync runs.
 */
function usePullToRefresh(onPull: () => void, disabled: boolean) {
  const [pull, setPull] = useState(0)
  const pullRef = useRef(0)
  const onPullRef = useRef(onPull)
  useEffect(() => {
    onPullRef.current = onPull
  })
  useEffect(() => {
    if (disabled) return
    let startY: number | null = null
    const start = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0]!.clientY : null
    }
    const move = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0]!.clientY - startY
      pullRef.current = dy > 0 && window.scrollY <= 0 ? Math.min(110, dy * 0.5) : 0
      setPull(pullRef.current)
    }
    const end = () => {
      if (pullRef.current >= PULL_TRIGGER_PX) onPullRef.current()
      startY = null
      pullRef.current = 0
      setPull(0)
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [disabled])
  return pull
}

/**
 * The sync state beside the avatar: its words only while a sync runs or has
 * just answered (3.0.2), and the pull that starts one. Amber once the data is
 * a day old.
 */
function SyncButton({ text, tone, spinning = false, onClick, disabled = false, shown = false }: Line) {
  const color = tone === 'caution' ? 'var(--tone-caution)' : 'var(--muted-foreground)'
  const pull = usePullToRefresh(onClick, disabled)
  return (
    <>
      <span role="status" aria-label={text} data-testid="sync-note" data-tone={tone} className="min-w-0 truncate text-right text-xs" style={{ color }}>
        {shown ? text : ''}
      </span>
      {(pull > 0 || spinning) && (
        <span
          aria-hidden
          data-testid="pull-indicator"
          className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card"
          style={{ transform: `translate(-50%, ${spinning ? 0 : pull - 36}px)`, opacity: spinning ? 1 : Math.min(1, pull / PULL_TRIGGER_PX) }}
        >
          <RotateCw size={16} strokeWidth={2.2} className={cn('text-muted-foreground', spinning && 'animate-spin')} style={spinning ? undefined : { rotate: `${pull * 3}deg` }} />
        </span>
      )}
    </>
  )
}

/** The owner's line: the same sync, states and limits as Settings' button (useSyncNow). */
function OwnerSyncLine({ user, lastSyncedAt, ago }: { user: User; lastSyncedAt: string; ago: string }) {
  const s = t.dashboard.syncStatus
  const sync = useSyncNow(user)
  const router = useRouter()
  const [freshNote, setFreshNote] = useState(false)
  const { phase } = sync

  // The new data is live: read it rather than leave yesterday's numbers up.
  useEffect(() => {
    if (phase.kind === 'done') router.refresh()
  }, [phase.kind, router])

  const age = syncAgeMs(lastSyncedAt)
  const late = isSyncLate(lastSyncedAt)
  const noteFresh = () => setFreshNote(true)
  let line: Line
  if (phase.kind === 'starting' || phase.kind === 'waiting') line = { text: s.syncing, tone: 'muted', spinning: true, disabled: true, shown: true, onClick: NOTHING }
  else if (phase.kind === 'failed') line = { text: s.failed, tone: 'caution', shown: true, onClick: sync.handleSync }
  else if (phase.kind === 'limited') line = { text: phase.reason === 'dailyCap' ? s.dailyCap : s.nextIn(Math.ceil(phase.retryAfterSec / 60)), tone: 'muted', disabled: true, shown: true, onClick: NOTHING }
  else if (phase.kind === 'done') line = { text: s.synced(s.justNow), tone: 'muted', shown: true, onClick: noteFresh }
  else if (phase.kind === 'upToDate') line = { text: s.upToDate, tone: 'muted', shown: true, onClick: noteFresh }
  else if (phase.kind === 'timedOut') line = { text: s.stillRunning, tone: 'muted', shown: true, onClick: sync.handleSync }
  // Fresh: nothing to fetch yet, and the server would hold it back anyway.
  else if (age < FRESH_SYNC_MS) line = { text: freshNote ? s.nextIn(Math.ceil((FRESH_SYNC_MS - age) / 60_000)) : s.synced(ago), tone: 'muted', shown: freshNote, onClick: noteFresh }
  else line = { text: isSyncStale(lastSyncedAt) ? `${s.synced(ago)} · ${s.tapToSync}` : s.synced(ago), tone: late ? 'caution' : 'accent', onClick: sync.handleSync }
  return <SyncButton {...line} />
}

/**
 * The header's sync control (design review, Oct 2026; a button in 3.0.2):
 * when the data last synced, and the way to sync it - at any age, not only
 * past 6 h, and without the date, which "Today" and every session's own date
 * already say. Amber once the data is a day old (v4.3.4). The owner's tap starts the sync; anyone
 * else's goes to Settings, where signing in lives.
 */
function SyncLine({ lastSyncedAt, ago }: { lastSyncedAt: string; ago: string }) {
  const s = t.dashboard.syncStatus
  const { user, isOwner } = useOwnerAuth()
  const router = useRouter()
  if (user && isOwner) return <OwnerSyncLine user={user} lastSyncedAt={lastSyncedAt} ago={ago} />
  const text = isSyncStale(lastSyncedAt) ? `${s.synced(ago)} · ${s.tapToSync}` : s.synced(ago)
  return <SyncButton text={text} tone={isSyncLate(lastSyncedAt) ? 'caution' : 'muted'} onClick={() => router.refresh()} />
}

/** "Monday, Oct 19", « Lundi 19 oct. »: the header's date over the title. */
export function headerDate(isoDate: string): string {
  return t.dashboard.headerDate(formatWeekdayLong(isoDate), formatDate(isoDate, { style: 'bare', year: 'never' }))
}

export function DashboardGreeting({ name, lastSyncedAt, today: serverToday }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const today = useToday(serverToday ?? appTodayIso())

  // After mount: an age worked out on the server is as old as the cached
  // page, and the browser's differs - React #418.
  const mounted = useMounted()
  const ago = mounted && lastSyncedAt ? formatRelativeAgo(lastSyncedAt) : null

  // The avatar and the sync button beside it fade as they scroll under the
  // status strip (v5.5 #3): the strip is only the safe area tall, and the
  // disc's lower edge showed under it as a sliver of accent. The title and
  // the date are the compact title bar's to fade, as on every page. At the
  // top they carry no inline style; faded out, they take no taps.
  const sideRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const side = sideRef.current
    if (!side) return
    let frame = 0
    const fade = () => {
      frame = 0
      const y = window.scrollY
      const opacity = y <= 0 ? 1 : Math.max(0, 1 - y / Math.max(1, side.offsetHeight))
      if (opacity >= 1) side.style.removeProperty('opacity')
      else side.style.opacity = String(opacity)
      if (opacity <= 0) side.style.pointerEvents = 'none'
      else side.style.removeProperty('pointer-events')
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fade) }
    fade()
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
    }
  }, [])

  return (
    // The page header (design review, Oct 2026): the date over the H1, and on
    // the right the sync button (3.0.2) beside the avatar. The verdict below is still the news.
    <header data-testid="today-header" className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <p data-title-sub data-testid="today-date" className="text-[13px] text-muted-foreground">
          {headerDate(today)}
        </p>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-foreground">{t.pages.dashboard.title}</h1>
      </div>
      <div ref={sideRef} className="flex min-w-0 shrink items-center gap-2.5">
        {ago && lastSyncedAt && <SyncLine lastSyncedAt={lastSyncedAt} ago={ago} />}
        {/* A link to Progress: the 40 pt disc, with a 44 pt hit area (hit-44)
            that doesn't take space. */}
        <Link
          href="/profile"
          aria-label={t.nav.items.profile}
          className="hit-44 flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95"
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground"
          >
            {initials(displayName)}
          </span>
        </Link>
      </div>
    </header>
  )
}
