'use client'

import Link from 'next/link'
import { ArrowRight, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { EditableNumber } from '@/components/ui/EditableNumber'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import type { ProfileGoal as ProfileGoalData } from '@/application/usecases/GetProfileData'
import type { GoalYear } from '@/application/usecases/GetGoalsData'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

interface Props {
  goal: ProfileGoalData | null
  onSaveGoal: (goalYear: GoalYear) => void
}

export function ProfileGoal({ goal, onSaveGoal }: Props) {
  if (!goal) return null

  const { goalYear, totalDistanceKm, projection } = goal
  const progressPercent = goalYear.annualDistanceKm > 0
    ? Math.min(100, round1((totalDistanceKm / goalYear.annualDistanceKm) * 100))
    : 0

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{t.profile.goal.title(goalYear.year)}</h2>
        <Target size={16} className="text-muted-foreground" aria-hidden="true" />
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            <AnimatedValue value={totalDistanceKm} />
          </span>
          <span className="text-micro font-semibold text-muted-foreground">
            {'/ '}
            <EditableNumber
              value={goalYear.annualDistanceKm}
              onCommit={(n) => onSaveGoal({ ...goalYear, annualDistanceKm: n })}
            />
            {' '}{t.units.km}
          </span>
        </div>

        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        {projection && (
          <p className={cn(
            'mt-1.5 text-micro font-medium',
            projection.status === 'behind' ? STATUS.warning.text : STATUS.success.text
          )}>
            {t.profile.goal.pace(projection.projectedYearKm)} {projection.status === 'behind' ? '↓' : '↑'}
          </p>
        )}
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

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
