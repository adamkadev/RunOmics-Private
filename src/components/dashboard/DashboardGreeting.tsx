'use client'

import { ATHLETE_NAME } from '@/domain/athlete/constants'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
        {initials(name)}
      </div>
    </div>
  )
}
