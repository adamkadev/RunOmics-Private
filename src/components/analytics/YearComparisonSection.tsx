'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { CardTitle } from '@/components/ui/SectionLabel'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { formatDate, formatDuration, formatKm, formatPace } from '@/lib/formatters'
import { METRIC_DELTA_COLORS } from '@/lib/colors'
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
      className="inline-flex items-center gap-0.5 text-xs font-medium"
      style={{ color: improved ? METRIC_DELTA_COLORS.good : METRIC_DELTA_COLORS.warn }}
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
      newer: `${formatKm(newer.distanceKm)} ${t.units.km}`,
      older: `${formatKm(older.distanceKm)} ${t.units.km}`,
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
        <CardTitle as="h2">{t.analytics.yearOverYear.title}</CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-subtle">
          {data.cutoff && <span>{t.analytics.yearOverYear.toDate(formatDate(data.cutoff, { style: 'bare', year: 'never' }))} ·</span>}
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
