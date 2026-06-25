'use client'

import { useRef, useState } from 'react'
import { User, Pencil } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { TONE_CLASS, type StatusTone } from '@/components/ui/StatusPill'
import type { ProfileHero as ProfileHeroData } from '@/application/usecases/GetProfileData'
import type { RankTier } from '@/application/usecases/GetAthleteRank'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const RANK_TONE: Record<RankTier, StatusTone> = {
  'S+': 'amber',
  S: 'amber',
  'A+': 'emerald',
  'A-': 'emerald',
  'B+': 'blue',
  'B-': 'blue',
  'C+': 'zinc',
  'C-': 'zinc',
  D: 'zinc',
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
    <GlassSurface variant="card" className="relative flex items-center gap-5 rounded-[22px] px-5 py-6">
      <div className="group/tip relative shrink-0">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 text-2xl font-extrabold text-accent-foreground shadow-[0_0_0_4px_var(--ring)] bg-accent"
          aria-hidden="true"
        >
          {displayName ? initials(displayName) : <User size={24} />}
        </div>
        {hero.rank && (
          <Tooltip content={t.profile.hero.rank(hero.rank.vo2max, hero.rank.consistencyScore)}>
            <span
              className={cn(
                'absolute -bottom-1 -right-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background px-1 text-[12px] font-extrabold',
                TONE_CLASS[RANK_TONE[hero.rank.tier]]
              )}
              aria-label={t.profile.hero.rank(hero.rank.vo2max, hero.rank.consistencyScore)}
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
            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xl font-extrabold tracking-tight text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">
            {displayName || t.profile.hero.namePlaceholder}
          </h1>
        )}
        {hero.sinceDate && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {t.profile.hero.since(monthYear(hero.sinceDate))}
          </p>
        )}
        <p className="mt-0.5 text-[13px] font-medium text-accent-text">
          {t.profile.hero.summary(hero.lifetimeActivities, hero.lifetimeDistanceKm)}
        </p>
      </div>

      <Button
        variant="secondary"
        onClick={startEditing}
        aria-label={t.profile.hero.editName}
        className="absolute right-5 top-4 h-8 w-8 rounded-[10px] p-0"
      >
        <Pencil size={16} />
      </Button>
    </GlassSurface>
  )
}
