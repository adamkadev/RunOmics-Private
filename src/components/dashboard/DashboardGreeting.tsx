'use client'

import { ATHLETE_NAME } from '@/domain/athlete/constants'
import { t } from '@/i18n'
import { SyncStatusBadge } from './SyncStatusBadge'

function isoWeek(d: Date): number {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

export function DashboardGreeting({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const now = new Date()
  const name = ATHLETE_NAME
  const g = t.pages.dashboard.greeting
  const text = now.getHours() < 12 ? g.morning : now.getHours() < 18 ? g.afternoon : g.evening
  const dateStr = now.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  const subtitle = g.weekDate(isoWeek(now), dateStr)

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-display text-foreground">{text}, {name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <SyncStatusBadge lastSyncedAt={lastSyncedAt} />
    </div>
  )
}