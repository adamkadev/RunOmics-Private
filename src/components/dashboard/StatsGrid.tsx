import { CalendarDays, Timer, Footprints, Heart, TrendingUp, Flame, Activity, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDuration, formatPace } from '@/lib/formatters'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { DashboardData } from '@/domain/activity/types'

interface Props {
  currentWeek: DashboardData['currentWeek']
  currentStreak: number
  vo2max: number | null
}

interface StatCell {
  Icon: LucideIcon
  color: string
  borderTop: string
  value: ReactNode
  label: string
}

export function StatsGrid({ currentWeek, currentStreak, vo2max }: Props) {
  const s = t.dashboard.stats

  const cells: StatCell[] = [
    {
      Icon: Footprints,
      color: 'text-emerald-500 dark:text-emerald-400',
      borderTop: 'border-t-emerald-400 dark:border-t-emerald-500',
      value: <><AnimatedValue value={currentWeek.totalDistanceKm} decimals={currentWeek.totalDistanceKm >= 10 ? 1 : 2} /> {t.units.km}</>,
      label: s.distance,
    },
    {
      Icon: Timer,
      color: 'text-blue-500 dark:text-blue-400',
      borderTop: 'border-t-blue-400 dark:border-t-blue-500',
      value: formatDuration(currentWeek.totalDurationSeconds),
      label: s.time,
    },
    {
      Icon: TrendingUp,
      color: 'text-amber-500 dark:text-amber-400',
      borderTop: 'border-t-amber-400 dark:border-t-amber-500',
      value: currentWeek.avgPaceSecPerKm ? formatPace(currentWeek.avgPaceSecPerKm) : s.empty,
      label: s.avgPace,
    },
    {
      Icon: Heart,
      color: 'text-red-500 dark:text-red-400',
      borderTop: 'border-t-red-400 dark:border-t-red-500',
      value: currentWeek.avgHeartRate
        ? <><AnimatedValue value={currentWeek.avgHeartRate} /> {t.units.bpm}</>
        : s.empty,
      label: s.avgHr,
    },
    {
      Icon: Flame,
      color: 'text-orange-500 dark:text-orange-400',
      borderTop: 'border-t-orange-400 dark:border-t-orange-500',
      value: <><AnimatedValue value={currentStreak} />d</>,
      label: s.streak,
    },
    {
      Icon: Activity,
      color: 'text-violet-500 dark:text-violet-400',
      borderTop: 'border-t-violet-400 dark:border-t-violet-500',
      value: vo2max !== null ? <AnimatedValue value={vo2max} /> : s.empty,
      label: s.vo2max,
    },
  ]

  return (
    <div className={cardClass({ overflow: true, padding: 'none' })}>
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3.5">
        <CalendarDays size={14} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-foreground">
          {t.pages.dashboard.subtitle(currentWeek.weekNumber % 100, currentWeek.sessionCount)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border lg:grid-cols-6">
        {cells.map(({ Icon, color, borderTop, value, label }) => (
          <div
            key={label}
            className={cn('flex flex-col items-center gap-0.5 border-t-2 bg-card px-3 py-3 text-center', borderTop)}
          >
            <Icon size={14} className={color} />
            <div className="whitespace-nowrap text-sm font-bold leading-tight text-foreground">{value}</div>
            <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
