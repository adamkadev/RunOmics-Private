'use client'

import { formatKm } from '@/lib/formatters'
import type { WeeklyStreakData } from '@/application/usecases/GetMilestones'
import type { WeekTarget } from '@/domain/training/weekTarget'
import { formatWeekKm } from '@/components/plan/weekPlanDays'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useCountUp } from '@/lib/useCountUp'
import { useToday } from '@/lib/useToday'
import { DayStateStrip } from '@/components/ui/DayStateStrip'
import { dayStateCells } from '@/components/plan/dayStateCells'
import { t } from '@/i18n'

const RING_SIZE = 76
const RING_STROKE = 7
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface Props {
  data: WeeklyStreakData
  /** This week against the volume goal and the plan - the same selector Plan and Activities read. */
  target: WeekTarget
  /** The date the page was prerendered on; see useToday. */
  today: string
}

export function WeeklyStreakCard({ data, target, today: serverToday }: Props) {
  const s = t.dashboard.weeklyStreak
  const todayIso = useToday(serverToday)
  const today = (new Date(`${todayIso}T00:00:00`).getDay() + 6) % 7

  const goal = target.goalKm !== null ? { targetKm: target.goalKm, actualKm: target.ranKm } : null
  const pct = goal ? Math.min(1, goal.actualKm / goal.targetKm) : 0
  const animatedPct = useCountUp(pct * 100) / 100
  const offset = RING_CIRCUMFERENCE * (1 - animatedPct)
  const animatedActualKm = useCountUp(goal?.actualKm ?? 0)
  const remaining = goal ? Math.max(0, Math.round(goal.targetKm - goal.actualKm)) : 0
  // The ring's number is the volume goal, and the plan is a different total:
  // naming both is what stops "6 of 23 km" here and "52 km" on Plan from
  // reading as two answers to one question.
  const goalLine = goal
    ? [s.goalLabel, target.planKm !== null ? s.planHas(target.planSessions, formatWeekKm(target.planKm)) : null]
        .filter(Boolean)
        .join(' · ')
    : null

  // A sentence about the week is not the week. What is left to run, spread over
  // the days left to run it in, is the number that decides today.
  const daysLeft = 7 - today
  const perDay = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : 0

  const headline = !goal
    ? s.weeksInARow(Math.round(data.currentWeeks))
    : remaining > 0 && daysLeft > 0
      ? s.perDayToGoal(formatKm(perDay, 1), formatKm(goal.targetKm))
      : remaining > 0
        ? s.kmRemaining(remaining)
        : s.goalReached

  return (
    <GlassSurface variant="card" className="px-4.5 py-3.5">
      <div className="flex items-center gap-3.5">
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
              <span className="text-title2 font-extrabold leading-none tabular-nums text-foreground">
                {Math.round(animatedActualKm)}
              </span>
              <span className="text-caption leading-tight text-muted-foreground">
                {s.ringOf(Math.round(goal.targetKm))}
              </span>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-subhead font-semibold text-foreground">{headline}</p>
          {goalLine && <p className="mt-0.5 text-xs text-muted-foreground">{goalLine}</p>}
        </div>
      </div>

      {/* The same state recipe as Plan's week: done, missed, still to come or
          rest, in the session's intensity, today ringed. The old dots drew a
          missed day and a rest day alike. */}
      <div className="mt-3">
        <DayStateStrip variant="dots" days={dayStateCells(target.days, todayIso, 'initial')} />
      </div>
    </GlassSurface>
  )
}
