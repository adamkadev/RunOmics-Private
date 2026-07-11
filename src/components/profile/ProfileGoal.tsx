import Link from 'next/link'
import { ArrowRight, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { ProfileGoal as ProfileGoalData } from '@/application/usecases/GetProfileData'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

interface Props {
  goal: ProfileGoalData | null
}

// A teaser into the Goals page, not a second copy of it: one headline number
// (percent complete) and a status word - the actual progress bar, projection
// curve, and editable target all live on /goals, their one home.
export function ProfileGoal({ goal }: Props) {
  if (!goal) return null

  const { goalYear, totalDistanceKm, projection } = goal
  const progressPercent = goalYear.annualDistanceKm > 0
    ? Math.min(100, Math.round((totalDistanceKm / goalYear.annualDistanceKm) * 100))
    : 0

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.goal.title(goalYear.year)}</h2>
        <Target size={16} className="text-muted-foreground" aria-hidden="true" />
      </div>

      <div>
        <span className="text-lg font-extrabold tracking-tight text-foreground">{progressPercent}%</span>
        <div className="mt-0.5 truncate text-micro text-muted-foreground">
          {t.profile.goal.progress(totalDistanceKm, goalYear.annualDistanceKm)}
          {projection && (
            <span className={cn('ml-1 font-medium', projection.status === 'behind' ? STATUS.warning.text : STATUS.success.text)}>
              · {t.goals.projection.status[projection.status]}
            </span>
          )}
        </div>
      </div>

      <Link
        href="/goals"
        className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-accent-text active:scale-95"
      >
        {t.profile.goal.viewGoals} <ArrowRight size={16} />
      </Link>
    </GlassSurface>
  )
}
