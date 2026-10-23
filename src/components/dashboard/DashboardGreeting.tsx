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
import { useRefreshWhenLive, useSyncNow } from '@/components/settings/SyncNowCard'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { fadeElement } from '@/lib/glassFade'
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

/** Past this the data is a day behind: the line turns amber. */
export const LATE_SYNC_MS = 24 * 3600_000

export function isSyncStale(lastSyncedAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastSyncedAt) > STALE_SYNC_MS
}

export function isSyncLate(lastSyncedAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastSyncedAt) > LATE_SYNC_MS
}

/** Read after mount, as every age here is. */
export function syncAgeMs(lastSyncedAt: string, now = Date.now()): number {
  return now - Date.parse(lastSyncedAt)
}

/** Under this, a sync has just run: a tap says when the next can go, and asks GitHub for nothing. */
const FRESH_SYNC_MS = SYNC_LIMITS.cooldownAfterSuccessMs

/** The sync button and the avatar share one 44 pt glass capsule, about 96 pt wide, as their copy in the compact bar. */
const CAPSULE = glassClass('regular', 'flex h-11 shrink-0 items-center gap-1 pr-1.5')
// Plain buttons in the glass, so the capsule swells as one.
const BUTTON = 'lg-press flex size-11 shrink-0 items-center justify-center rounded-full'

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

function SyncButton({ text, tone, spinning = false, onClick, disabled = false, shown = false, children }: Line & { children: ReactNode }) {
  const color = tone === 'caution' ? 'var(--tone-caution)' : 'var(--muted-foreground)'
  return (
    <div className="flex min-w-0 items-center">
      <span role="status" data-testid="sync-note" className={cn('min-w-0 truncate text-right text-xs', shown && 'mr-2')} style={{ color }}>
        {shown ? text : ''}
      </span>
      <div data-testid="today-capsule" className={CAPSULE}>
        <GlassLayers />
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={text}
          title={text}
          data-testid="sync-line"
          data-tone={tone}
          // The compact bar copies it once the page scrolls, its arrows turning on data-bar-busy.
          data-bar-action="refresh"
          data-bar-busy={spinning ? '' : undefined}
          className={BUTTON}
          style={{ color }}
        >
          <RotateCw size={20} strokeWidth={2} aria-hidden className={cn('shrink-0', spinning && 'animate-spin')} />
        </button>
        {children}
      </div>
    </div>
  )
}

function OwnerSyncLine({ user, lastSyncedAt, ago, children }: { user: User; lastSyncedAt: string; ago: string; children: ReactNode }) {
  const s = t.dashboard.syncStatus
  const sync = useSyncNow(user)
  const router = useRouter()
  const [freshNote, setFreshNote] = useState(false)
  const { phase } = sync

  useRefreshWhenLive(phase, router.refresh)

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

/** No date in its words: "Today" and every session's own date already say it. */
function SyncLine({ lastSyncedAt, ago, children }: { lastSyncedAt: string; ago: string; children: ReactNode }) {
  const s = t.dashboard.syncStatus
  const { user, isOwner } = useOwnerAuth()
  const router = useRouter()
  if (user && isOwner) return <OwnerSyncLine user={user} lastSyncedAt={lastSyncedAt} ago={ago}>{children}</OwnerSyncLine>
  const text = isSyncStale(lastSyncedAt) ? `${s.synced(ago)} · ${s.tapToSync}` : s.synced(ago)
  return <SyncButton text={text} tone={isSyncLate(lastSyncedAt) ? 'caution' : 'muted'} onClick={() => router.push('/settings')}>{children}</SyncButton>
}

/** "Monday, Oct 19", « Lundi 19 oct. » */
export function headerDate(isoDate: string): string {
  return t.dashboard.headerDate(formatWeekdayLong(isoDate), formatDate(isoDate, { style: 'bare', year: 'never' }))
}

export function DashboardGreeting({ name, lastSyncedAt, today: serverToday }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const today = useToday(serverToday ?? appTodayIso())

  // After mount: an age worked out on the server is as old as the cached page (React #418 hydration mismatch).
  const mounted = useMounted()
  const ago = mounted && lastSyncedAt ? formatRelativeAgo(lastSyncedAt) : null

  // The status strip is only the safe area tall, so the avatar and sync button fade as they scroll under it; the title and date are the compact bar's to fade.
  const sideRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const side = sideRef.current
    if (!side) return
    let frame = 0
    const fade = () => {
      frame = 0
      const y = window.scrollY
      const opacity = y <= 0 ? 1 : Math.max(0, 1 - y / Math.max(1, side.offsetHeight))
      // Each on its own: the capsule fades its glass layers, never itself, which would flatten its blur.
      for (const el of side.querySelectorAll<HTMLElement>('[data-testid="sync-note"], [data-testid="today-capsule"]')) fadeElement(el, opacity)
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

  const avatar = (
    <Link
      href="/profile"
      aria-label={t.nav.items.profile}
      // The compact bar keeps it at the top right once the page scrolls.
      data-bar-action="avatar"
      className="lg-press hit-44 flex size-8 shrink-0 items-center justify-center rounded-full"
    >
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground">
        {initials(displayName)}
      </span>
    </Link>
  )

  return (
    <header data-testid="today-header" className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <p data-title-sub data-testid="today-date" className="text-[15px] leading-5 text-muted-foreground">
          {headerDate(today)}
        </p>
        <h1 className="text-large-title text-foreground">{t.pages.dashboard.title}</h1>
      </div>
      <div ref={sideRef} className="flex min-w-0 shrink items-center">
        {ago && lastSyncedAt ? (
          <SyncLine lastSyncedAt={lastSyncedAt} ago={ago}>{avatar}</SyncLine>
        ) : (
          <div data-testid="today-capsule" className={cn(CAPSULE, 'pl-1.5')}>
            <GlassLayers />
            {avatar}
          </div>
        )}
      </div>
    </header>
  )
}
