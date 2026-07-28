import Link from 'next/link'
import { User, Settings } from 'lucide-react'
import type { ProfileHero as ProfileHeroData } from '@/application/usecases/GetProfileData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { vo2maxTopPercent } from '@/domain/athlete/vo2maxNorms'
import { initials } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  hero: ProfileHeroData
  displayName?: string
  age?: number
  sex?: 'male' | 'female'
}

// The Progress mockup's athlete card is a glass card, not a deep --hero-gradient
// panel: the accent shows through the avatar's --accent-gradient tile and the
// RANK pill, while the text stays theme-foreground so it reads on the glass in
// both modes. (This is the one member of the "hero" family the mockup renders as
// glass; TodayHero/CelebrationOverlay stay gradient panels.)
export function ProfileHero({ hero, displayName, age, sex }: Props) {
  const topPct = hero.rank?.vo2maxGarmin != null && age !== undefined && sex
    ? vo2maxTopPercent(hero.rank.vo2maxGarmin, age, sex)
    : null

  return (
    <GlassSurface variant="card" className="flex items-center gap-3.5 p-4">
      <div
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-lg font-bold text-accent-foreground"
        style={{ background: 'var(--accent-gradient)' }}
        aria-hidden="true"
      >
        {displayName ? initials(displayName) : <User size={20} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-lg font-bold text-foreground">
            {displayName || t.profile.hero.namePlaceholder}
          </h1>
          {hero.rank && (
            <span
              className="shrink-0 rounded-[6px] px-1.5 py-0.5 font-mono text-micro font-bold text-accent-text"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}
            >
              {t.profile.hero.rankBadge(hero.rank.tier)}
            </span>
          )}
        </div>
        {topPct !== null && (
          <p className="text-caption text-muted-foreground">
            {t.profile.hero.topPctLine(topPct)}
          </p>
        )}
        <p className="mt-0.5 text-caption text-subtle">
          {t.profile.hero.lifetime(hero.lifetimeActivities, hero.lifetimeDistanceKm)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <Link
          href="/settings"
          aria-label={t.nav.items.settings}
          className="flex h-9 w-9 items-center justify-center rounded-control bg-foreground/[0.06] text-muted-foreground transition-colors hover:bg-foreground/10 active:scale-95"
        >
          <Settings size={16} />
        </Link>
      </div>
    </GlassSurface>
  )
}
