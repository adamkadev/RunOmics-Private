import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKm } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ProfileGoal as ProfileGoalData } from '@/application/usecases/GetProfileData'
import { PROJECTION_TONE } from '@/lib/statusColors'
import { t } from '@/i18n'

interface Props {
  goal: ProfileGoalData | null
}

export function ProfileGoal({ goal }: Props) {
  if (!goal) return null

  const { goalYear, totalDistanceKm, projection } = goal
  const progressPercent = goalYear.annualDistanceKm > 0
    ? Math.min(100, Math.round((totalDistanceKm / goalYear.annualDistanceKm) * 100))
    : 0

  const signedDeltaKm = projection ? projection.projectedYearKm - goalYear.annualDistanceKm : 0
  const p = t.goals.projection
  const outcome =
    signedDeltaKm < 0 ? p.shortBy(formatKm(-signedDeltaKm))
    : signedDeltaKm > 0 ? p.overBy(formatKm(signedDeltaKm))
    : projection ? p.status[projection.status] : null

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-bold text-foreground">{t.profile.goal.title(goalYear.year)}</h2>

      <div>
        {/* A percentage of the year beside a word about the projection read as a
            contradiction - 66% next to "Behind". The bar already says the
            percentage, so the one number here is the projection itself. */}
        {projection ? (
          <>
            <div
              className={cn(
                'whitespace-nowrap text-lg font-extrabold tracking-tight',
                PROJECTION_TONE[projection.status],
              )}
            >
              {p.projectedValue(formatKm(projection.projectedYearKm))}
            </div>
            <div className="truncate text-caption font-semibold text-muted-foreground">
              {[p.projectedLabel, outcome].filter(Boolean).join(' · ')}
            </div>
          </>
        ) : (
          <div className="text-lg font-extrabold tracking-tight text-foreground">{progressPercent}%</div>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-1.5 truncate text-micro text-muted-foreground">
          {t.profile.goal.progress(formatKm(totalDistanceKm), formatKm(goalYear.annualDistanceKm))}
        </div>
      </div>

      <Link
        href="/goals"
        className="mt-auto flex min-h-6 items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.goal.viewGoals} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
