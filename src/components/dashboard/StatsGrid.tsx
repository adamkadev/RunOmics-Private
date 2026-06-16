import { Timer, Footprints, Heart, TrendingUp, TrendingDown, Minus, Flame, Activity } from 'lucide-react'
import { formatDuration, formatPace } from '@/lib/formatters'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { t } from '@/i18n'
import type { DashboardData } from '@/domain/activity/types'

interface Props {
  currentWeek: DashboardData['currentWeek']
  lastWeek: DashboardData['lastWeek']
  currentStreak: number
  longestStreak: number
  vo2max: number | null
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (Math.abs(diff) < 0.5) return <Minus size={12} className="text-subtle" />
  return diff > 0 ? (
    <TrendingUp size={12} className="text-emerald-500 dark:text-emerald-400" />
  ) : (
    <TrendingDown size={12} className="text-red-500 dark:text-red-400" />
  )
}

export function StatsGrid({ currentWeek, lastWeek, currentStreak, longestStreak, vo2max }: Props) {
  const s = t.dashboard.stats
  const stats: { label: string; value: React.ReactNode; sub: string; trend: React.ReactNode; icon: React.ReactNode }[] = [
    {
      label: s.distance,
      value: <><AnimatedValue value={currentWeek.totalDistanceKm} decimals={currentWeek.totalDistanceKm >= 10 ? 1 : 2} /> {t.units.km}</>,
      sub: s.distanceSub(`${lastWeek.totalDistanceKm.toFixed(lastWeek.totalDistanceKm >= 10 ? 1 : 2)} ${t.units.km}`),
      trend: <Trend current={currentWeek.totalDistanceKm} previous={lastWeek.totalDistanceKm} />,
      icon: <Footprints size={18} className="text-emerald-600 dark:text-emerald-400" />,
    },
    {
      label: s.time,
      value: formatDuration(currentWeek.totalDurationSeconds),
      sub: t.common.sessions(currentWeek.sessionCount),
      trend: null,
      icon: <Timer size={18} className="text-blue-500 dark:text-blue-400" />,
    },
    {
      label: s.avgHr,
      value: currentWeek.avgHeartRate
        ? <><AnimatedValue value={currentWeek.avgHeartRate} /> {t.units.bpm}</>
        : s.empty,
      sub: s.thisWeek,
      trend: null,
      icon: <Heart size={18} className="text-red-500 dark:text-red-400" />,
    },
    {
      label: s.avgPace,
      value: currentWeek.avgPaceSecPerKm ? formatPace(currentWeek.avgPaceSecPerKm) : s.empty,
      sub: s.thisWeek,
      trend: null,
      icon: <TrendingUp size={18} className="text-amber-500 dark:text-amber-400" />,
    },
    {
      label: s.streak,
      value: <><AnimatedValue value={currentStreak} />d</>,
      sub: s.streakSub(longestStreak),
      trend: null,
      icon: <Flame size={18} className="text-orange-500 dark:text-orange-400" />,
    },
    {
      label: s.vo2max,
      value: vo2max !== null ? <AnimatedValue value={vo2max} /> : s.empty,
      sub: t.units.vo2max,
      trend: null,
      icon: <Activity size={18} className="text-violet-500 dark:text-violet-400" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(({ label, value, sub, trend, icon }, i) => (
        <div
          key={label}
          className="animate-fade-up rounded-xl border border-border bg-card p-4 shadow-card"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            {icon}
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <div className="mt-1 flex items-center gap-1">
            {trend}
            <span className="text-xs text-subtle">{sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
