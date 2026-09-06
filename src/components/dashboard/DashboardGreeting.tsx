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
