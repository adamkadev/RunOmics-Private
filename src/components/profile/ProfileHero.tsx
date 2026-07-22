import Link from 'next/link'
import { User, Settings } from 'lucide-react'
import type { ProfileHero as ProfileHeroData } from '@/application/usecases/GetProfileData'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  hero: ProfileHeroData
  displayName?: string
  age?: number
  sex?: 'male' | 'female'
}

// Hub hero per audit §13c: rank + lifetime summary promoted into the same
// hero-gradient card language as Today's readiness verdict.
export function ProfileHero({ hero, displayName, age, sex }: Props) {
  const topPct = hero.rank?.vo2maxGarmin != null && age !== undefined && sex
    ? vo2maxTopPercent(hero.rank.vo2maxGarmin, age, sex)
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
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-lg font-bold text-white">
            {displayName || t.profile.hero.namePlaceholder}
          </h1>
          {hero.rank && (
            <span className="shrink-0 rounded-[6px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-foreground">
              {t.profile.hero.rankBadge(hero.rank.tier)}
            </span>
          )}
        </div>
        {topPct !== null && (
          <p className="text-[11px] text-white/70">
            {t.profile.hero.topPctLine(topPct)}
          </p>
        )}
        <p className="mt-0.5 text-[10.5px] text-white/55">
          {t.profile.hero.lifetime(hero.lifetimeActivities, hero.lifetimeDistanceKm)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5">
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
