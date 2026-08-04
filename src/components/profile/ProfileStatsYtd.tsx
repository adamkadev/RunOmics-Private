'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { Pill } from '@/components/ui/Pill'
import type { ProfilePeriodStats } from '@/application/usecases/GetProfileData'
import { t } from '@/i18n'

interface Cell {
  value: ReactNode
  unit?: string
  label: string
}

type Period = 'year' | 'allTime'

const PERIODS: { id: Period; chip: string }[] = [
  { id: 'year', chip: t.profile.ytd.thisYearChip },
  { id: 'allTime', chip: t.profile.ytd.allTimeChip },
]

interface Props {
  ytd: ProfilePeriodStats
  allTime: ProfilePeriodStats
}

export function ProfileStatsYtd({ ytd, allTime }: Props) {
  const [period, setPeriod] = useState<Period>('year')
  const stats = period === 'year' ? ytd : allTime

  const cells: Cell[] = [
    { value: <AnimatedValue value={stats.distanceKm} />, unit: t.units.km, label: t.profile.ytd.distance },
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
      {/* The scope chip replaces the old static "This year" heading - one filled
          chip carries the active window, same selection language as Analytics. */}
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
            <div className="mt-0.5 text-caption text-muted-foreground">{cell.label}</div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
