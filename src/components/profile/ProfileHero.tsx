'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { User, Pencil, Settings } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ProfileHero as ProfileHeroData } from '@/application/usecases/GetProfileData'
import type { RankTier } from '@/domain/athlete/rank'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Gradient + glow scale up with the tier so S-rank actually feels earned.
const RANK_BADGE_CLASS: Record<RankTier, string> = {
  'S+': 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-amber-950 ring-amber-100/80 shadow-[0_0_14px_2.5px_rgba(245,158,11,0.65)]',
  S: 'bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 text-amber-950 ring-amber-100/70 shadow-[0_0_10px_2px_rgba(245,158,11,0.45)]',
  'A+': 'bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-600 text-emerald-950 ring-emerald-100/70 shadow-[0_0_10px_2px_rgba(16,185,129,0.4)]',
  'A-': 'bg-gradient-to-br from-emerald-200 via-emerald-300 to-emerald-500 text-emerald-950 ring-emerald-100/60 shadow-sm',
  'B+': 'bg-gradient-to-br from-sky-300 via-sky-400 to-sky-600 text-sky-950 ring-sky-100/60 shadow-sm',
  'B-': 'bg-gradient-to-br from-sky-200 via-sky-300 to-sky-500 text-sky-950 ring-sky-100/50 shadow-sm',
  'C+': 'bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 text-zinc-900 ring-white/40 shadow-sm',
  'C-': 'bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 text-zinc-800 ring-white/40 shadow-sm',
  D: 'bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 text-zinc-700 ring-white/40 shadow-sm',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function monthYear(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

interface Props {
  hero: ProfileHeroData
  displayName?: string
  onSaveName: (name: string) => void
}

export function ProfileHero({ hero, displayName, onSaveName }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayName ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing() {
    setDraft(displayName ?? '')
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (displayName ?? '')) onSaveName(trimmed)
  }

  return (
    <GlassSurface variant="card" className="flex items-center gap-4 px-5 py-5">
      <div className="group/tip relative shrink-0">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 text-2xl font-extrabold text-accent-foreground shadow-[0_0_0_4px_var(--ring)] bg-accent"
          aria-hidden="true"
        >
          {displayName ? initials(displayName) : <User size={24} />}
        </div>
        {hero.rank && (
          <Tooltip content={t.profile.hero.rank(hero.rank.vo2maxGarmin, hero.rank.vdot)}>
            <span
              className={cn(
                'absolute -bottom-1.5 -right-1.5 flex h-8 min-w-8 -rotate-6 items-center justify-center rounded-full border-[2.5px] border-background px-1.5 text-footnote font-black italic leading-none tracking-tight ring-1',
                RANK_BADGE_CLASS[hero.rank.tier]
              )}
              aria-label={t.profile.hero.rank(hero.rank.vo2maxGarmin, hero.rank.vdot)}
            >
              {hero.rank.tier}
            </span>
          </Tooltip>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder={t.profile.hero.namePlaceholder}
            className="w-full rounded-xl border border-border bg-card/80 px-2 py-1 text-title1 font-extrabold tracking-tight text-foreground backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <h1 className="truncate text-title1 font-extrabold tracking-tight text-foreground">
            {displayName || t.profile.hero.namePlaceholder}
          </h1>
        )}
        {hero.sinceDate && (
          <p className="mt-0.5 text-footnote text-muted-foreground">
            {t.profile.hero.since(monthYear(hero.sinceDate))}
          </p>
        )}
        <p className="mt-0.5 text-footnote font-medium text-accent-text">
          {t.profile.hero.summary(hero.lifetimeActivities, hero.lifetimeDistanceKm)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <Button
          variant="secondary"
          onClick={startEditing}
          aria-label={t.profile.hero.editName}
          className="h-11 w-11 rounded-control p-0"
        >
          <Pencil size={16} />
        </Button>
        <Link
          href="/settings"
          aria-label={t.nav.items.settings}
          className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-foreground/[0.06] text-muted-foreground transition-colors hover:bg-foreground/[0.10] active:scale-95"
        >
          <Settings size={20} />
        </Link>
      </div>
    </GlassSurface>
  )
}
