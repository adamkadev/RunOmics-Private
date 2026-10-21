'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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

/**
 * The sync button and the avatar share one 40 pt glass capsule (owner, Oct
 * 2026, as Claude's and Bevel's tops pair theirs), 32 pt each in its 4 pt of
 * glass, as their copy in the compact bar; hit-44 keeps the targets 44 pt.
 */
const CAPSULE = 'glass-float flex shrink-0 items-center gap-1 rounded-full p-1'
const BUTTON =
  'hit-44 flex size-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:active:scale-100'

interface Line {
  text: string
  tone: 'muted' | 'accent' | 'caution'
  spinning?: boolean
  disabled?: boolean
  /** The words on screen beside the button: while a sync runs or has just answered, never at rest. */
  shown?: boolean
  onClick: () => void
}

const NOTHING = () => {}

/**
 * The sync control (3.0.2, mock 5f; back in place of the pull, Oct 2026): a
 * round ↻ beside the avatar, its words - "Synced 14h ago" - its accessible
 * name at rest, and on screen beside it once pressed: while the sync runs,
 * and what it answered. The arrows turn while it runs; amber, button and
 * words, once the data is a day old.
 */
function SyncButton({ text, tone, spinning = false, onClick, disabled = false, shown = false, children }: Line & { children: ReactNode }) {
  const color = tone === 'caution' ? 'var(--tone-caution)' : 'var(--muted-foreground)'
  return (
    <div className="flex min-w-0 items-center">
      <span role="status" data-testid="sync-note" className={cn('min-w-0 truncate text-right text-xs', shown && 'mr-2')} style={{ color }}>
        {shown ? text : ''}
      </span>
      {/* The avatar (children) beside it, in the same glass. */}
      <div data-testid="today-capsule" className={CAPSULE}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={text}
          title={text}
          data-testid="sync-line"
          data-tone={tone}
          // The compact bar keeps it beside the avatar once the page scrolls,
          // its arrows turning while the sync runs (data-bar-busy).
          data-bar-action="refresh"
          data-bar-busy={spinning ? '' : undefined}
          className={BUTTON}
          style={{ color }}
        >
          <RotateCw size={17} strokeWidth={2.2} aria-hidden className={cn('shrink-0', spinning && 'animate-spin')} />
        </button>
        {children}
      </div>
    </div>
  )
}

/** The owner's line: the same sync, states and limits as Settings' button (useSyncNow). */
function OwnerSyncLine({ user, lastSyncedAt, ago, children }: { user: User; lastSyncedAt: string; ago: string; children: ReactNode }) {
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
  return <SyncButton {...line}>{children}</SyncButton>
}

/**
 * The header's sync control (design review, Oct 2026; a button in 3.0.2):
 * when the data last synced, and the way to sync it - at any age, not only
 * past 6 h, and without the date, which "Today" and every session's own date
 * already say. Amber once the data is a day old (v4.3.4). The owner's tap starts the sync; anyone
 * else's goes to Settings, where signing in lives.
 */
function SyncLine({ lastSyncedAt, ago, children }: { lastSyncedAt: string; ago: string; children: ReactNode }) {
  const s = t.dashboard.syncStatus
  const { user, isOwner } = useOwnerAuth()
  const router = useRouter()
  if (user && isOwner) return <OwnerSyncLine user={user} lastSyncedAt={lastSyncedAt} ago={ago}>{children}</OwnerSyncLine>
  const text = isSyncStale(lastSyncedAt) ? `${s.synced(ago)} · ${s.tapToSync}` : s.synced(ago)
  return <SyncButton text={text} tone={isSyncLate(lastSyncedAt) ? 'caution' : 'muted'} onClick={() => router.push('/settings')}>{children}</SyncButton>
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

  // A link to Progress: the accent disc, in the sync button's capsule.
  const avatar = (
    <Link
      href="/profile"
      aria-label={t.nav.items.profile}
      // The compact bar keeps it at the top right once the page scrolls.
      data-bar-action="avatar"
      className="hit-44 flex size-8 shrink-0 items-center justify-center rounded-full active:scale-95"
    >
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">
        {initials(displayName)}
      </span>
    </Link>
  )

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
      <div ref={sideRef} className="flex min-w-0 shrink items-center">
        {ago && lastSyncedAt ? (
          <SyncLine lastSyncedAt={lastSyncedAt} ago={ago}>{avatar}</SyncLine>
        ) : (
          <div data-testid="today-capsule" className={CAPSULE}>{avatar}</div>
        )}
      </div>
    </header>
  )
}
