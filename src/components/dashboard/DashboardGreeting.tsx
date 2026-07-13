'use client'

import { useEffect, useState } from 'react'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  name?: string
}

interface Greeting {
  text: string
  dateLine: string
}

function computeGreeting(): Greeting {
  const now = new Date()
  const g = t.pages.dashboard.greeting
  const text = now.getHours() < 12 ? g.morning : now.getHours() < 18 ? g.afternoon : g.evening
  const dateLine = `${now.toLocaleDateString(t.locale, { weekday: 'short', month: 'short', day: 'numeric' })} · ${now.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}`
  return { text, dateLine }
}

// Mockup header: small muted date line first, then the greeting title, with a
// 34px gradient avatar on the right.
//
// This is time-of-day dependent, but the app is statically built - the server-rendered
// HTML is frozen at build time, while a user can hydrate hours or days later. Computing
// `now` during render (rather than after mount) would hydrate-mismatch on every visit
// that lands in a different hour than the build. Rendered client-only instead.
export function DashboardGreeting({ name }: Props) {
  const displayName = name ?? t.profile.hero.namePlaceholder
  const [greeting, setGreeting] = useState<Greeting | null>(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGreeting(computeGreeting()))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] capitalize text-subtle">{greeting?.dateLine ?? ' '}</p>
        <h1 className="font-display text-[21px] font-bold tracking-tight text-foreground">
          {greeting?.text ?? ' '}, {displayName}
        </h1>
      </div>
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-accent-foreground"
        style={{ background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 74%, #000))' }}
      >
        {initials(displayName)}
      </div>
    </div>
  )
}
