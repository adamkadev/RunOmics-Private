'use client'

import { Flame } from 'lucide-react'
import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import type { WeeklyGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useCountUp } from '@/lib/useCountUp'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const RING_SIZE = 128
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function WeeklyGoalRing({ goal }: { goal: WeeklyGoal }) {
  const s = t.dashboard.weeklyStreak
  const pct = goal.targetKm > 0 ? Math.min(1, goal.actualKm / goal.targetKm) : 0
  const animatedPct = useCountUp(pct * 100) / 100
  const offset = RING_CIRCUMFERENCE * (1 - animatedPct)
  const remaining = Math.max(0, Math.round((goal.targetKm - goal.actualKm) * 10) / 10)

  return (
    <GlassSurface variant="card" className="flex flex-col items-center p-5 text-center">
      <div className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.weeklyGoal}</div>
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE} className="stroke-foreground/10" />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            className="stroke-emerald-500"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-title2 font-extrabold leading-none tabular-nums text-foreground">
            {Math.round(goal.actualKm)}
          </span>
          <span className="text-xs text-muted-foreground">/ {Math.round(goal.targetKm)} {t.units.km}</span>
        </div>
      </div>
      <p className="mt-3.5 text-xs text-muted-foreground">
        {remaining > 0 ? s.kmRemaining(remaining) : s.goalReached}
      </p>
    </GlassSurface>
  )
}

function WeekDots({ weekDays }: { weekDays: boolean[] }) {
  const labels = t.calendar.weekdays
  const today = (new Date().getDay() + 6) % 7 // Mon=0..Sun=6

  return (
    <div className="flex justify-between">
      {weekDays.map((active, i) => (
        <div key={i} className="text-center">
          <div
            className={cn(
              'h-6 w-6 rounded-full',
              active
                ? 'bg-emerald-500'
                : i > today
                  ? 'border-2 border-dashed border-foreground/15'
                  : 'bg-foreground/10'
            )}
          />
          <div className="mt-1 text-micro text-muted-foreground">{labels[i]?.slice(0, 1)}</div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data: WeeklyStreakData
  goal: WeeklyGoal | null
}

export function WeeklyStreakCard({ data, goal }: Props) {
  const s = t.dashboard.weeklyStreak
  const animatedWeeks = useCountUp(data.currentWeeks)

  return (
    <div className={cn('grid grid-cols-1 gap-4', goal && 'lg:grid-cols-[1fr_1.4fr]')}>
      {goal && <WeeklyGoalRing goal={goal} />}
      <GlassSurface variant="card" className="p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-orange-500/[0.12]">
            <Flame size={22} className="text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-base font-bold tabular-nums text-foreground">
              {s.weeksInARow(Math.round(animatedWeeks))}
            </div>
            {data.longestWeeks > data.currentWeeks && (
              <div className="text-xs text-muted-foreground">{s.longestStreak(data.longestWeeks)}</div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <WeekDots weekDays={data.weekDays} />
        </div>
      </GlassSurface>
    </div>
  )
}
