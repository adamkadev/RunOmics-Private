'use client'

import { ATHLETE_NAME } from '@/domain/athlete/constants'
import { t } from '@/i18n'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function DashboardGreeting() {
  const now = new Date()
  const name = ATHLETE_NAME
  const g = t.pages.dashboard.greeting
  const text = now.getHours() < 12 ? g.morning : now.getHours() < 18 ? g.afternoon : g.evening
  const subtitle = now.toLocaleDateString(t.locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-display text-foreground">{text}, {name}</h1>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d2e1a] text-sm font-bold text-emerald-400">
        {initials(name)}
      </div>
    </div>
  )
}
