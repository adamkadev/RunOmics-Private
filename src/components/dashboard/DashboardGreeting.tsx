'use client'

import { ATHLETE_NAME } from '@/domain/athlete/constants'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

// Mockup header: small muted date line first, then the greeting title, with a
// 34px gradient avatar on the right.
export function DashboardGreeting() {
  const now = new Date()
  const name = ATHLETE_NAME
  const g = t.pages.dashboard.greeting
  const text = now.getHours() < 12 ? g.morning : now.getHours() < 18 ? g.afternoon : g.evening
  const dateLine = `${now.toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })} · ${now.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] capitalize text-subtle">{dateLine}</p>
        <h1 className="font-display text-[21px] font-bold tracking-tight text-foreground">{text}, {name}</h1>
      </div>
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent-foreground"
        style={{ background: 'linear-gradient(140deg, var(--accent), var(--accent-dark, var(--accent)))' }}
      >
        {initials(name)}
      </div>
    </div>
  )
}
