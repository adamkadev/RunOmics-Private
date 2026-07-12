'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { User, Pencil, Settings } from 'lucide-react'
import type { ProfileHero as ProfileHeroData } from '@/application/usecases/GetProfileData'
import { ATHLETE_BIRTHDATE, ATHLETE_SEX } from '@/domain/athlete/constants'
import { ageFromBirthdate, vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  hero: ProfileHeroData
  displayName?: string
  onSaveName: (name: string) => void
}

// Hub hero per audit §13c: rank + lifetime summary promoted into the same
// hero-gradient card language as Today's readiness verdict.
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

  const topPct = hero.rank?.vo2maxGarmin != null
    ? vo2maxTopPercent(hero.rank.vo2maxGarmin, ageFromBirthdate(ATHLETE_BIRTHDATE), ATHLETE_SEX)
    : null

  return (
    <div
      className="flex items-center gap-3.5 rounded-[20px] border border-accent/30 p-4"
      style={{ background: 'var(--hero-gradient)' }}
    >
      <div
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-lg font-bold text-accent-foreground"
        style={{ background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 74%, #000))' }}
        aria-hidden="true"
      >
        {displayName ? initials(displayName) : <User size={20} />}
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
            className="w-full rounded-lg border border-white/20 bg-black/25 px-2 py-0.5 font-display text-base font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        ) : (
          <h1 className="truncate font-display text-base font-bold text-white">
            {displayName || t.profile.hero.namePlaceholder}
          </h1>
        )}
        {hero.rank && topPct !== null && (
          <p
            className="text-[11px] font-semibold"
            style={{ color: 'color-mix(in srgb, var(--accent) 42%, #ffffff)' }}
          >
            {t.profile.hero.rankLine(hero.rank.tier, topPct)}
          </p>
        )}
        <p className="mt-0.5 text-[10.5px] text-white/55">
          {t.profile.hero.lifetime(hero.lifetimeActivities, hero.lifetimeDistanceKm)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={startEditing}
          aria-label={t.profile.hero.editName}
          className="flex h-9 w-9 items-center justify-center rounded-control bg-white/10 text-white/80 transition-colors hover:bg-white/20 active:scale-95"
        >
          <Pencil size={14} />
        </button>
        <Link
          href="/settings"
          aria-label={t.nav.items.settings}
          className="flex h-9 w-9 items-center justify-center rounded-control bg-white/10 text-white/80 transition-colors hover:bg-white/20 active:scale-95"
        >
          <Settings size={16} />
        </Link>
      </div>
    </div>
  )
}
