'use client'

import { useEffect, useState } from 'react'
import { initials, formatRelativeAgo } from '@/lib/formatters'
import { useMounted } from '@/lib/useMounted'
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
  const syncedLine = mounted && lastSyncedAt ? t.dashboard.syncStatus.synced(formatRelativeAgo(lastSyncedAt)) : null

  return (
    <div className="flex items-center justify-between gap-3">
      {/* The greeting was the largest type on the screen and the only thing on it
          that is not about the running. What the date and the sync age say is
          worth one muted line; the verdict below is the headline. */}
      <p className="min-w-0 truncate text-footnote text-muted-foreground">
        {/* The date only exists after mount, so join the two parts rather than
            printing a separator with nothing in front of it. */}
        {/* capitalize only the date - applied to the whole line it turned
            "synced 13h ago" into "Synced 13h Ago". */}
        {dateLine ? <span className="capitalize">{dateLine}</span> : null}
        {dateLine && syncedLine ? ' · ' : null}
        {syncedLine ?? null}
        {!dateLine && !syncedLine ? ' ' : null}
      </p>
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent-foreground"
        style={{ background: 'var(--accent-gradient)' }}
      >
        {initials(displayName)}
      </div>
    </div>
  )
}
