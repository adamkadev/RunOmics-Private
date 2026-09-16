'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { Pill } from '@/components/ui/Pill'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { metricDeltaColor } from '@/lib/colors'
import { formatDelta } from '@/lib/formatters'
import { round } from '@/lib/math'
import { t } from '@/i18n'

interface Cell {
  value: ReactNode
  unit?: string
  label: string
  /** Signed change against the same point last year, in the cell's own unit. */
  delta?: number
  /** Below this, the change is rounding rather than news, so it stays neutral. */
  noise: number
}

type Period = 'year' | 'allTime'

const PERIODS: { id: Period; chip: string }[] = [
  { id: 'year', chip: t.profile.ytd.thisYearChip },
  { id: 'allTime', chip: t.profile.ytd.allTimeChip },
]

interface Props {
  ytd: ProfilePeriodStats
  allTime: ProfilePeriodStats
  prevYear: ProfilePeriodStats | null
}

const HOURS = (stats: ProfilePeriodStats) => Math.round(stats.durationSeconds / 3600)
const THOUSAND_KCAL = (stats: ProfilePeriodStats) => stats.calories / 1000
// Each side is rounded before subtracting, so a delta is exactly the difference
// of the two numbers on screen rather than of the two behind them.
const THOUSAND_KCAL_SHOWN = (stats: ProfilePeriodStats) => round(THOUSAND_KCAL(stats), 1)

export function ProfileStatsYtd({ ytd, allTime, prevYear }: Props) {
  const [period, setPeriod] = useState<Period>('year')
  const stats = period === 'year' ? ytd : allTime
  const prevYearLabel = new Date().getFullYear() - 1

  // All-time has nothing to compare against, and a first year of training has
  // no baseline - a delta off a zero prior year is just the total again.
  const baseline = period === 'year' ? prevYear : null
  const delta = (pick: (stats: ProfilePeriodStats) => number) =>
    baseline ? pick(stats) - pick(baseline) : undefined

  const cells: Cell[] = [
    { value: <AnimatedValue value={stats.distanceKm} />, unit: t.units.km, label: t.profile.ytd.distance, delta: delta((s) => s.distanceKm), noise: 1 },
    { value: <AnimatedValue value={HOURS(stats)} />, unit: t.units.hour, label: t.profile.ytd.duration, delta: delta(HOURS), noise: 1 },
    { value: <AnimatedValue value={stats.sessionCount} />, label: t.profile.ytd.sessions, delta: delta((s) => s.sessionCount), noise: 0 },
    { value: <>+<AnimatedValue value={stats.elevationGainM} /></>, unit: t.units.m, label: t.profile.ytd.elevation, delta: delta((s) => s.elevationGainM), noise: 10 },
    { value: <AnimatedValue value={stats.avgKmPerWeek} decimals={1} />, unit: t.units.km, label: t.profile.ytd.avgPerWeek, delta: delta((s) => s.avgKmPerWeek), noise: 0.5 },
    ...(stats.calories > 0
      ? [{
          value: <AnimatedValue value={THOUSAND_KCAL(stats)} decimals={1} />,
          unit: `k ${t.units.kcal}`,
          label: t.profile.ytd.calories,
          delta: delta(THOUSAND_KCAL_SHOWN),
          noise: 1,
        }]
      : []),
  ]

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center gap-1.5">
        {PERIODS.map((p) => (
          <Pill
            key={p.id}
            as="button"
            variant={p.id === period ? 'accent' : 'neutral'}
            className="px-3 py-1.5 text-micro font-semibold uppercase tracking-wide"
            aria-pressed={p.id === period}
            onClick={() => setPeriod(p.id)}
          >
            {p.chip}
          </Pill>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              i < Math.floor((cells.length - 1) / 3) * 3 &&
                'border-b border-foreground/[0.07] pb-3.5',
              i % 3 !== 0 && 'border-l border-foreground/[0.07] pl-3'
            )}
          >
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">{cell.value}</span>
              {cell.unit && <span className="text-caption font-semibold text-muted-foreground">{cell.unit}</span>}
            </div>
            {/* One line each, always: the label cannot wrap and the delta line is
                reserved whether or not the cell has a comparison, so all six
                cells are the same height and the two rows read off one grid. */}
            <div className="mt-0.5 truncate text-caption text-muted-foreground">{cell.label}</div>
            <div className="mt-1 h-3 truncate text-micro font-semibold leading-none tabular-nums">
              {cell.delta === undefined ? (
                <span className="text-subtle">{t.profile.ytd.noComparison}</span>
              ) : (
                <>
                  <span style={{ color: metricDeltaColor(cell.delta, 'up', cell.noise) }}>
                    {formatDelta(cell.delta)}
                  </span>{' '}
                  <span className="font-medium text-subtle">{t.profile.ytd.vsLastYear(prevYearLabel)}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
