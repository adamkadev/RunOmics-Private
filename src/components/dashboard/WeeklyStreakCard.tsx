'use client'

import { Check } from 'lucide-react'
import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import type { WeeklyGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useCountUp } from '@/lib/useCountUp'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const RING_SIZE = 76
const RING_STROKE = 7
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function WeekDots({ weekDays, plannedDays, today }: { weekDays: boolean[]; plannedDays: boolean[]; today: number }) {
  const labels = t.plan.weekdays

  return (
    <div className="flex justify-between">
      {weekDays.map((active, i) => {
        const isToday = i === today
        const isFuture = i > today
        const isRest = !active && !isFuture && !plannedDays[i]
        return (
          <div key={i} className="text-center">
            <div
              className={cn(
                'mx-auto flex h-[26px] w-[26px] items-center justify-center rounded-full',
                active
                  ? 'bg-accent'
                  : isFuture
                    ? 'border-[1.5px] border-dashed border-foreground/15'
                    : isRest
                      ? 'bg-accent/15'
                      : 'bg-foreground/10',
                isToday && !active && 'border-2 border-accent bg-transparent'
              )}
              style={
                isToday && !active
                  ? { boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 50%, transparent)' }
                  : undefined
              }
            >
              {active && <Check size={13} strokeWidth={3.2} className="text-accent-foreground" />}
              {isRest && !isToday && <Check size={13} strokeWidth={3.2} className="text-accent-text" />}
            </div>
            <div className={cn('mt-1 text-micro', isToday ? 'font-semibold text-accent-text' : 'text-muted-foreground')}>
              {labels[i]?.slice(0, 1)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  data: WeeklyStreakData
  goal: WeeklyGoal | null
}

export function WeeklyStreakCard({ data, goal }: Props) {
  const s = t.dashboard.weeklyStreak
  const today = (new Date().getDay() + 6) % 7 // Mon=0..Sun=6

  const pct = goal && goal.targetKm > 0 ? Math.min(1, goal.actualKm / goal.targetKm) : 0
  const animatedPct = useCountUp(pct * 100) / 100
  const offset = RING_CIRCUMFERENCE * (1 - animatedPct)
  const animatedActualKm = useCountUp(goal?.actualKm ?? 0)
  const isFreshWeek = goal !== null && goal.actualKm === 0
  const remaining = goal ? Math.max(0, Math.round(goal.targetKm - goal.actualKm)) : 0

  const headline = !goal
    ? s.weeksInARow(Math.round(data.currentWeeks))
    : isFreshWeek
      ? s.freshWeek
      : remaining > 0
        ? s.kmRemaining(remaining)
        : s.goalReached

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="flex items-center gap-4">
        {goal && (
          <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
              <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE} className="stroke-foreground/10" />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                style={{ stroke: 'var(--accent)' }}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
              <span className="text-sm font-extrabold leading-none tabular-nums text-foreground">
                {Math.round(animatedActualKm)}
              </span>
              <span className="text-caption leading-tight text-muted-foreground">/{Math.round(goal.targetKm)}{t.units.km}</span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">{headline}</p>
          {isFreshWeek && (
            <p className="mt-0.5 text-xs text-muted-foreground">{s.freshWeekGoal(Math.round(goal.targetKm))}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <WeekDots weekDays={data.weekDays} plannedDays={data.plannedDays} today={today} />
      </div>
    </GlassSurface>
  )
}
