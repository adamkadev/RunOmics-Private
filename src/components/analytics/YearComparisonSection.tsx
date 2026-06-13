'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { formatDuration, formatPace } from '@/lib/formatters'

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

  if (neutral) return <Minus size={12} className="text-gray-400" />

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      }`}
    >
      {improved ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
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
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
      <span className="w-32 text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="flex-1 text-right text-sm font-semibold text-gray-900 dark:text-white">
        {newer}
      </span>
      <DeltaBadge pct={pct} lowerIsBetter={lowerIsBetter} />
      <span className="w-24 text-right text-sm text-gray-400 dark:text-gray-500">{older}</span>
    </div>
  )
}

export function YearComparisonSection({ data }: Props) {
  const { newer, older } = data
  const [y1, y2] = data.years

  const rows = [
    {
      label: 'Distance',
      newer: `${newer.distanceKm.toFixed(0)} km`,
      older: `${older.distanceKm.toFixed(0)} km`,
      pct: delta(newer.distanceKm, older.distanceKm),
    },
    {
      label: 'Sessions',
      newer: String(newer.sessionCount),
      older: String(older.sessionCount),
      pct: delta(newer.sessionCount, older.sessionCount),
    },
    {
      label: 'Time',
      newer: formatDuration(newer.durationSeconds),
      older: formatDuration(older.durationSeconds),
      pct: delta(newer.durationSeconds, older.durationSeconds),
    },
    {
      label: 'Avg / week',
      newer: `${newer.avgKmPerWeek} km`,
      older: `${older.avgKmPerWeek} km`,
      pct: delta(newer.avgKmPerWeek, older.avgKmPerWeek),
    },
    ...(newer.avgPaceSecPerKm && older.avgPaceSecPerKm
      ? [
          {
            label: 'Avg pace',
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
            label: 'Avg HR',
            newer: `${newer.avgHeartRate} bpm`,
            older: `${older.avgHeartRate} bpm`,
            pct: delta(newer.avgHeartRate, older.avgHeartRate),
            lowerIsBetter: true,
          },
        ]
      : []),
    {
      label: 'Elevation',
      newer: `+${newer.elevationM} m`,
      older: `+${older.elevationM} m`,
      pct: delta(newer.elevationM, older.elevationM),
    },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Year over Year</h2>
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-semibold text-gray-900 dark:text-white">{y1}</span>
          <span>vs</span>
          <span>{y2}</span>
        </div>
      </div>

      <div>
        {rows.map((row) => (
          <MetricRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  )
}
