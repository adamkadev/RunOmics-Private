'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { formatDuration, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  data: YearComparisonData
}

function delta(newer: number, older: number): number {
  if (older === 0) return 0
  return Math.round(((newer - older) / older) * 100)
}

function DeltaBadge({ pct, lowerIsBetter = false }: { pct: number; lowerIsBetter?: boolean }) {
  const improved = lowerIsBetter ? pct < 0 : pct > 0
  const neutral = pct === 0

  if (neutral) return <Minus size={12} className="text-subtle" />

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        improved ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      }`}
    >
      {improved ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(pct)}%
    </span>
  )
}

interface MetricRowProps {
  label: string
  newer: string
  older: string
  pct: number
  lowerIsBetter?: boolean
}

function MetricRow({ label, newer, older, pct, lowerIsBetter }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 border-b border-border py-3 last:border-0">
      <span className="w-24 shrink-0 sm:w-32 text-sm text-muted-foreground">{label}</span>
      <span className="flex-1 text-right text-sm font-semibold text-foreground whitespace-nowrap">
        {newer}
      </span>
      <span className="shrink-0"><DeltaBadge pct={pct} lowerIsBetter={lowerIsBetter} /></span>
      <span className="w-20 shrink-0 sm:w-24 text-right text-sm text-subtle whitespace-nowrap">{older}</span>
    </div>
  )
}

export function YearComparisonSection({ data }: Props) {
  const { newer, older } = data
  const [y1, y2] = data.years

  const rowLabels = t.analytics.yearOverYear.rows
  const rows = [
    {
      label: rowLabels.distance,
      newer: `${newer.distanceKm.toFixed(0)} ${t.units.km}`,
      older: `${older.distanceKm.toFixed(0)} ${t.units.km}`,
      pct: delta(newer.distanceKm, older.distanceKm),
    },
    {
      label: rowLabels.sessions,
      newer: String(newer.sessionCount),
      older: String(older.sessionCount),
      pct: delta(newer.sessionCount, older.sessionCount),
    },
    {
      label: rowLabels.time,
      newer: formatDuration(newer.durationSeconds),
      older: formatDuration(older.durationSeconds),
      pct: delta(newer.durationSeconds, older.durationSeconds),
    },
    {
      label: rowLabels.avgPerWeek,
      newer: `${newer.avgKmPerWeek} ${t.units.km}`,
      older: `${older.avgKmPerWeek} ${t.units.km}`,
      pct: delta(newer.avgKmPerWeek, older.avgKmPerWeek),
    },
    ...(newer.avgPaceSecPerKm && older.avgPaceSecPerKm
      ? [
          {
            label: rowLabels.avgPace,
            newer: formatPace(newer.avgPaceSecPerKm),
            older: formatPace(older.avgPaceSecPerKm),
            pct: delta(newer.avgPaceSecPerKm, older.avgPaceSecPerKm),
            lowerIsBetter: true,
          },
        ]
      : []),
    ...(newer.avgHeartRate && older.avgHeartRate
      ? [
          {
            label: rowLabels.avgHr,
            newer: `${newer.avgHeartRate} ${t.units.bpm}`,
            older: `${older.avgHeartRate} ${t.units.bpm}`,
            pct: delta(newer.avgHeartRate, older.avgHeartRate),
            lowerIsBetter: true,
          },
        ]
      : []),
    {
      label: rowLabels.elevation,
      newer: t.analytics.stats.elevationValue(newer.elevationM),
      older: t.analytics.stats.elevationValue(older.elevationM),
      pct: delta(newer.elevationM, older.elevationM),
    },
  ]

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t.analytics.yearOverYear.title}</h2>
        <div className="flex items-center gap-4 text-xs text-subtle">
          <span className="font-semibold text-foreground">{y1}</span>
          <span>{t.analytics.yearOverYear.vs}</span>
          <span>{y2}</span>
        </div>
      </div>

      <div>
        {rows.map((row) => (
          <MetricRow key={row.label} {...row} />
        ))}
      </div>
    </GlassSurface>
  )
}
