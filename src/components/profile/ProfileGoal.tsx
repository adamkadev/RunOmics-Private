'use client'

import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { EditableNumber } from '@/components/ui/EditableNumber'
import type { ProfileGoal as ProfileGoalData } from '@/application/usecases/GetProfileData'
import type { GoalYear } from '@/application/usecases/GetGoalsData'
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
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <h2 className="mb-2 text-sm font-bold text-foreground">{t.profile.goal.title(goalYear.year)}</h2>

      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-extrabold tracking-tight text-foreground">
          {totalDistanceKm.toLocaleString('en-US')}
        </span>
        <span className="text-[13px] font-semibold text-muted-foreground">
          {'/ '}
          <EditableNumber
            value={goalYear.annualDistanceKm}
            onCommit={(n) => onSaveGoal({ ...goalYear, annualDistanceKm: n })}
          />
          {' '}{t.units.km}
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#0e9f6e,#2ed9a0)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {projection && (
        <p className={cn(
          'mt-2 text-[11.5px] font-medium',
          projection.status === 'behind' ? 'text-amber-600 dark:text-amber-400' : 'text-accent-text'
        )}>
          {t.profile.goal.pace(projection.projectedYearKm)} {projection.status === 'behind' ? '↓' : '↑'}
        </p>
      )}
    </GlassSurface>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
