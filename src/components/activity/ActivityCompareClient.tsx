'use client'

import { ActivityTypeTag } from '@/components/activities/ActivityTypeTag'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { CHART_COLORS } from '@/lib/colors'
import { formatClock, formatDate, formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'
import { PaceCompareChart } from './PaceCompareChart'
import { HrCompareChart } from './HrCompareChart'
import { ElevationCompareChart } from './ElevationCompareChart'
import { CadenceCompareChart } from './CadenceCompareChart'
import { t } from '@/i18n'

interface Props {
  a: Activity
  b: Activity
}

interface CompareRow {
  label: string
  valueA: string
  valueB: string
  delta: string
}

function signed(value: number, format: (abs: number) => string): string {
  return `${value >= 0 ? '+' : '-'}${format(Math.abs(value))}`
}

function buildRows(a: Activity, b: Activity): CompareRow[] {
  const rows: CompareRow[] = [
    {
      label: t.activity.stats.distance,
      valueA: formatDistance(a.distanceKm),
      valueB: formatDistance(b.distanceKm),
      delta: signed(b.distanceKm - a.distanceKm, formatDistance),
    },
    {
      label: t.activity.stats.duration,
      valueA: formatDuration(a.durationSeconds),
      valueB: formatDuration(b.durationSeconds),
      delta: signed(b.durationSeconds - a.durationSeconds, formatDuration),
    },
  ]

  if (a.paceSecPerKm && b.paceSecPerKm) {
    rows.push({
      label: t.activity.stats.avgPace,
      valueA: formatPace(a.paceSecPerKm),
      valueB: formatPace(b.paceSecPerKm),
      delta: `${signed(b.paceSecPerKm - a.paceSecPerKm, formatClock)}/${t.units.km}`,
    })
  }

  if (a.avgHeartRate && b.avgHeartRate) {
    rows.push({
      label: t.activity.stats.avgHr,
      valueA: `${a.avgHeartRate} ${t.units.bpm}`,
      valueB: `${b.avgHeartRate} ${t.units.bpm}`,
      delta: `${signed(b.avgHeartRate - a.avgHeartRate, String)} ${t.units.bpm}`,
    })
  }

  if (a.elevationGain != null && b.elevationGain != null) {
    rows.push({
      label: t.activity.stats.elevation,
      valueA: t.activity.stats.elevationValue(a.elevationGain),
      valueB: t.activity.stats.elevationValue(b.elevationGain),
      delta: `${signed(b.elevationGain - a.elevationGain, String)} ${t.units.m}`,
    })
  }

  if (a.cadenceSpm != null && b.cadenceSpm != null) {
    rows.push({
      label: t.activity.stats.cadence,
      valueA: `${Math.round(a.cadenceSpm)} ${t.units.spm}`,
      valueB: `${Math.round(b.cadenceSpm)} ${t.units.spm}`,
      delta: `${signed(Math.round(b.cadenceSpm) - Math.round(a.cadenceSpm), String)} ${t.units.spm}`,
    })
  }

  return rows
}

function ActivitySummaryCard({ activity, color }: { activity: Activity; color: string }) {
  return (
    <GlassSurface variant="card" className="space-y-1.5 rounded-2xl p-4">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <ActivityTypeTag type={activity.type} />
      </div>
      <p className="text-sm font-medium text-foreground">
        {activity.description || t.activity.runTitle(activity.dayOfWeek)}
      </p>
      <p className="text-xs text-muted-foreground">{formatDate(activity.date)}</p>
    </GlassSurface>
  )
}

export function ActivityCompareClient({ a, b }: Props) {
  const rows = buildRows(a, b)
  const hasHr = !!(a.hrSamples && b.hrSamples)
  const hasPace = !!(a.paceSamples && b.paceSamples)
  const hasCadence = !!(a.cadenceSamples && b.cadenceSamples)
  const hasElevation = !!(a.elevationProfile && b.elevationProfile)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ActivitySummaryCard activity={a} color={CHART_COLORS.compareA} />
        <ActivitySummaryCard activity={b} color={CHART_COLORS.compareB} />
      </div>

      <GlassSurface variant="card" className="overflow-hidden rounded-[22px]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.08] text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">{t.compare.metric}</th>
              <th className="px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center justify-end gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS.compareA }} />A
                </span>
              </th>
              <th className="px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center justify-end gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS.compareB }} />B
                </span>
              </th>
              <th className="px-4 py-2 text-right font-medium">{t.compare.delta}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-foreground/[0.06] last:border-0">
                <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                <td className="px-2 py-2 text-right font-medium text-foreground">{row.valueA}</td>
                <td className="px-2 py-2 text-right font-medium text-foreground">{row.valueB}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassSurface>

      {(hasHr || hasPace || hasCadence || hasElevation) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hasHr && (
            <HrCompareChart
              samplesA={a.hrSamples!}
              samplesB={b.hrSamples!}
              distanceA={a.distanceKm}
              distanceB={b.distanceKm}
              avgA={a.avgHeartRate}
              avgB={b.avgHeartRate}
            />
          )}
          {hasPace && (
            <PaceCompareChart
              samplesA={a.paceSamples!}
              samplesB={b.paceSamples!}
              distanceA={a.distanceKm}
              distanceB={b.distanceKm}
              avgA={a.paceSecPerKm}
              avgB={b.paceSecPerKm}
            />
          )}
          {hasCadence && (
            <CadenceCompareChart
              samplesA={a.cadenceSamples!}
              samplesB={b.cadenceSamples!}
              distanceA={a.distanceKm}
              distanceB={b.distanceKm}
              avgA={a.cadenceSpm}
              avgB={b.cadenceSpm}
            />
          )}
          {hasElevation && (
            <ElevationCompareChart
              samplesA={a.elevationProfile!}
              samplesB={b.elevationProfile!}
              distanceA={a.distanceKm}
              distanceB={b.distanceKm}
            />
          )}
        </div>
      )}
    </div>
  )
}
