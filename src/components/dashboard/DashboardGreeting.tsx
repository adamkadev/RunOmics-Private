'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { initials, formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { authorizedFetch } from '@/lib/ownerFetch'
import { writeStoredSince } from '@/lib/syncSince'
import { t } from '@/i18n'

interface Props {
  name?: string
  lastSyncedAt?: string | null
}

// Read after mount, not during render: the date depends on the reader's clock,
// and the page is served from an ISR cache that can be an hour old.
function todayLine(): string {
  return new Date().toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Past this the data is a day behind in practice: the pill turns amber. */
export const STALE_SYNC_MS = 6 * 3600_000

export function isSyncStale(lastSyncedAt: string, now = Date.now()): boolean {
  return now - Date.parse(lastSyncedAt) > STALE_SYNC_MS
}

type SyncPhase = 'idle' | 'syncing' | 'failed'

/**
 * "Synced 23h ago · tap to sync" as an amber pill (H06, M7). The owner's tap
 * dispatches the sync Settings runs, and Settings' card picks it up from the
 * stored start; anyone else is taken to Settings.
 */
function StaleSyncPill({ ago }: { ago: string }) {
  const s = t.dashboard.syncStatus
  const { user, isOwner } = useOwnerAuth()
  const router = useRouter()
  const [phase, setPhase] = useState<SyncPhase>('idle')

  async function sync() {
    if (!user || !isOwner) {
      router.push('/settings')
      return
    }
    setPhase('syncing')
    try {
      const response = await authorizedFetch(user, '/api/sync/dispatch', { method: 'POST' })
      if (!response.ok) throw new Error(`dispatch failed with ${response.status}`)
      writeStoredSince(((await response.json()) as { since: string }).since)
    } catch (error) {
      console.error('Sync dispatch failed:', error)
      setPhase('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={phase === 'syncing'}
      data-testid="sync-pill"
      className="min-w-0 truncate whitespace-nowrap rounded-full px-2 py-1 text-caption font-semibold transition-opacity active:opacity-70"
      style={{ color: 'var(--tone-caution)', background: 'var(--segmented-track)' }}
    >
      {phase === 'syncing' ? s.syncing : phase === 'failed' ? s.failed : `${s.synced(ago)} · ${s.tapToSync}`}
    </button>
  )
}

export function DashboardGreeting({ name, lastSyncedAt }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const [dateLine, setDateLine] = useState<string | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDateLine(todayLine()))
    return () => cancelAnimationFrame(raf)
  }, [])

  // After mount too, for the same reason: an age worked out on the server is
  // as old as the cached page, and the browser's differs - React #418.
  const mounted = useMounted()
  const ago = mounted && lastSyncedAt ? formatRelativeAgo(lastSyncedAt) : null
  const stale = ago !== null && lastSyncedAt ? isSyncStale(lastSyncedAt) : false
  const syncedLine = ago && !stale ? t.dashboard.syncStatus.synced(ago) : null

  return (
    // As tall as the 34 pt disc, not its 44 pt hit area: a 44 pt row put the
    // date line 5 pt lower than every other page's title.
    <div className="flex h-8.5 items-center justify-between gap-3">
      {/* The greeting was the largest type on the screen and the only thing on it
          that is not about the running. What the date and the sync age say is
          worth one muted line; the verdict below is the headline. */}
      <div className="flex min-w-0 items-center gap-2">
        <p className={stale ? 'shrink-0 text-footnote text-muted-foreground' : 'min-w-0 truncate text-footnote text-muted-foreground'}>
        {/* The date only exists after mount, so join the two parts rather than
            printing a separator with nothing in front of it. */}
        {/* capitalize only the date - applied to the whole line it turned
            "synced 13h ago" into "Synced 13h Ago". */}
        {dateLine ? <span className="capitalize">{dateLine}</span> : null}
        {dateLine && syncedLine ? ' · ' : null}
        {syncedLine ?? null}
        {!dateLine && !syncedLine ? ' ' : null}
        </p>
        {stale && ago && <StaleSyncPill ago={ago} />}
      </div>
      {/* It looked tappable and was a plain div. A link to Progress now: the
          34 pt disc, with a 44 pt hit area (hit-44) that doesn't take space. */}
      <Link
        href="/profile"
        aria-label={t.nav.items.profile}
        className="hit-44 flex size-8.5 shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        <span
          aria-hidden="true"
          className="flex size-8.5 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
        >
          {initials(displayName)}
        </span>
      </Link>
    </div>
  )
}
