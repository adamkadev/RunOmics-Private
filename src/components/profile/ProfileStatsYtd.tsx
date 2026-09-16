'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { Pill } from '@/components/ui/Pill'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { metricDeltaColor } from '@/lib/colors'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

interface Cell {
  value: ReactNode
  unit?: string
  label: string
  /** Signed change against the same point last year, in the cell's own unit. */
  delta?: number
}

// Both sides of the comparison are whole kilometres, so anything under one is
// rounding rather than a change worth colouring.
const YOY_NOISE_KM = 1

type Period = 'year' | 'allTime'

const PERIODS: { id: Period; chip: string }[] = [
  { id: 'year', chip: t.profile.ytd.thisYearChip },
  { id: 'allTime', chip: t.profile.ytd.allTimeChip },
]

interface Props {
  ytd: ProfilePeriodStats
  allTime: ProfilePeriodStats
  prevYearDistanceKm: number
}

export function ProfileStatsYtd({ ytd, allTime, prevYearDistanceKm }: Props) {
  const [period, setPeriod] = useState<Period>('year')
  const stats = period === 'year' ? ytd : allTime
  const prevYear = new Date().getFullYear() - 1
  // All-time has nothing to compare against, and a first year of training has no
  // baseline - a delta off a zero prior year is just the total again.
  const distanceDelta =
    period === 'year' && prevYearDistanceKm > 0 ? stats.distanceKm - prevYearDistanceKm : undefined

  const cells: Cell[] = [
    { value: <AnimatedValue value={stats.distanceKm} />, unit: t.units.km, label: t.profile.ytd.distance, delta: distanceDelta },
    { value: <AnimatedValue value={Math.round(stats.durationSeconds / 3600)} />, unit: t.units.hour, label: t.profile.ytd.duration },
    { value: <AnimatedValue value={stats.sessionCount} />, label: t.profile.ytd.sessions },
    { value: <>+<AnimatedValue value={stats.elevationGainM} /></>, unit: t.units.m, label: t.profile.ytd.elevation },
    { value: <AnimatedValue value={stats.avgKmPerWeek} decimals={1} />, unit: t.units.km, label: t.profile.ytd.avgPerWeek },
    ...(stats.calories > 0
      ? [{
          value: <AnimatedValue value={stats.calories / 1000} decimals={1} />,
          unit: `k ${t.units.kcal}`,
          label: t.profile.ytd.calories,
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
            variant={p.id === period ? 'active' : 'neutral'}
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
            <div className="mt-1 h-3 text-micro font-semibold leading-none tabular-nums">
              {cell.delta !== undefined && (
                <>
                  <span style={{ color: metricDeltaColor(cell.delta, 'up', YOY_NOISE_KM) }}>
                    {formatDelta(cell.delta)}
                  </span>{' '}
                  <span className="font-medium text-subtle">{t.profile.ytd.vsLastYear(prevYear)}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
