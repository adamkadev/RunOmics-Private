'use client'

import { useEffect, useState } from 'react'
import { initials, formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  name?: string
  lastSyncedAt?: string | null
}

interface Greeting {
  text: string
  dateLine: string
}

function computeGreeting(): Greeting {
  const now = new Date()
  const g = t.pages.dashboard.greeting
  const text = now.getHours() < 12 ? g.morning : now.getHours() < 18 ? g.afternoon : g.evening
  const dateLine = now.toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })
  return { text, dateLine }
}

// Mockup header: small muted date line first, then the greeting title, with a
// 34px gradient avatar on the right. The sync status rides on the date line
// (date - Synced Xh ago) instead of the time - the clock time isn't useful
// once sync freshness is shown there instead.
//
// This is time-of-day dependent, but the app is statically built - the server-rendered
// HTML is frozen at build time, while a user can hydrate hours or days later. Computing
// `now` during render (rather than after mount) would hydrate-mismatch on every visit
// that lands in a different hour than the build. Rendered client-only instead.
export function DashboardGreeting({ name, lastSyncedAt }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const [greeting, setGreeting] = useState<Greeting | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGreeting(computeGreeting()))
    return () => cancelAnimationFrame(raf)
  }, [])

  const syncedLine = lastSyncedAt ? t.dashboard.syncStatus.synced(formatRelativeAgo(lastSyncedAt)) : null

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-caption text-subtle">
          {/* capitalize scoped to the date only - applied to the whole line it
              would title-case "ago" in the synced text too. */}
          <span className="capitalize">{greeting?.dateLine ?? ' '}</span>
          {syncedLine ? ` · ${syncedLine}` : ''}
        </p>
        <h1 className="font-display text-title2 font-bold tracking-tight text-foreground">
          {greeting?.text ?? ' '}, {displayName}
        </h1>
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
