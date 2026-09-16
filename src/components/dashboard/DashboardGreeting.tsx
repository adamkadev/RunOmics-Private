'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { initials, formatCountdown, formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  name?: string
  lastSyncedAt?: string | null
  nextRace?: UpcomingRace | null
}

// Read after mount, not during render: the date depends on the reader's clock,
// and the page is served from an ISR cache that can be an hour old.
function todayLine(): string {
  return new Date().toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function DashboardGreeting({ name, lastSyncedAt, nextRace }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const [dateLine, setDateLine] = useState<string | null>(null)
  const [daysToRace, setDaysToRace] = useState<number | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setDateLine(todayLine())
      setDaysToRace(
        nextRace
          ? Math.ceil((new Date(nextRace.date + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
          : null,
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [nextRace])

  const syncedLine = lastSyncedAt ? t.dashboard.syncStatus.synced(formatRelativeAgo(lastSyncedAt)) : null

  return (
    <div className="flex items-start justify-between gap-3">
      {/* The greeting was the largest type on the screen and the only thing on it
          that is not about the running. What the date and the sync age say is
          worth one muted line; the verdict below is the headline. */}
      <div className="min-w-0">
        <p className="truncate text-footnote text-muted-foreground">
          {/* The date only exists after mount, so join the two parts rather than
              printing a separator with nothing in front of it. */}
          {/* capitalize only the date - applied to the whole line it turned
              "synced 13h ago" into "Synced 13h Ago". */}
          {dateLine ? <span className="capitalize">{dateLine}</span> : null}
          {dateLine && syncedLine ? ' · ' : null}
          {syncedLine ?? null}
          {!dateLine && !syncedLine ? ' ' : null}
        </p>
        {nextRace && daysToRace !== null && daysToRace > 0 && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-micro font-bold text-accent-text">
            <Flag size={10} className="shrink-0" />
            <span className="shrink-0 font-mono">{formatCountdown(daysToRace)}</span>
            <span className="truncate font-semibold">{nextRace.name}</span>
          </p>
        )}
      </div>
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent-foreground"
        style={{ background: 'var(--accent-gradient)' }}
      >
        {initials(displayName)}
      </div>
    </div>
  )
}
