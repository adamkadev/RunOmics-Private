'use client'

import { useState } from 'react'
import type { Activity } from '@/domain/activity/types'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { HrChart } from './HrChart'
import { ElevationChart } from './ElevationChart'
import { PaceChart } from './PaceChart'
import { CadenceChart } from './CadenceChart'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { t } from '@/i18n'
import { STATUS } from '@/lib/statusColors'

interface Props {
  activity: Activity
}

function rpeToneClass(rpe: number): string {
  if (rpe <= 4) return STATUS.success.text
  if (rpe <= 6) return 'text-foreground'
  return STATUS.warning.text
}

function buildStats(activity: Activity): Metric[] {
  const stats: Metric[] = [
    {
      value: formatDistance(activity.distanceKm),
      label: t.units.km,
    },
    {
      value: formatDurationShort(activity.durationSeconds),
      label: t.activity.stats.duration,
    },
  ]

  if (activity.paceSecPerKm) {
    stats.push({
      value: formatClock(activity.paceSecPerKm),
      label: t.units.perKm,
    })
  }

  if (activity.avgHeartRate) {
    stats.push({
      value: `${activity.avgHeartRate}`,
      label: t.units.bpm,
    })
  }

  if (activity.calories != null) {
    stats.push({
      value: `${activity.calories}`,
      label: t.units.kcal,
    })
  }

  if (activity.elevationGain !== null) {
    stats.push({
      value: `${activity.elevationGain > 0 ? '+' : '-'}${Math.abs(activity.elevationGain)}`,
      label: t.units.elevation,
    })
  }

  if (activity.cadenceSpm != null) {
    stats.push({
      value: `${Math.round(activity.cadenceSpm)}`,
      label: t.units.spm,
    })
  }

  stats.push({
    value: activity.rpe !== null ? t.activity.stats.rpeValue(activity.rpe) : t.activity.stats.rpe,
    label: activity.rpe !== null ? (t.rpeLabels[activity.rpe] ?? '-') : t.activity.stats.na,
    // RPE semantics (ACTIVITY_DETAIL_TASKS.md C4): easy (1-4) accent, moderate (5-6) neutral, hard (7-10) amber.
    valueClassName: activity.rpe !== null ? rpeToneClass(activity.rpe) : undefined,
  })

  return stats
}

export function ActivityDetailClient({ activity }: Props) {
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)
  const stats = buildStats(activity)
  const hasSecondaryCharts = !!(activity.elevationProfile || activity.paceSamples || activity.cadenceSamples)

  return (
    <>
      <div className="h-[260px] overflow-hidden rounded-card border border-border sm:h-[360px]">
        {activity.route ? (
          <ActivityMapClient
            route={activity.route}
            paceSamples={activity.paceSamples}
            hoverFraction={hoverFraction}
            avgTemperature={activity.avgTemperature}
            className="h-full w-full"
          />
        ) : (
          <NoRouteMap className="h-full w-full" />
        )}
      </div>

      <GlassSurface variant="card" className="p-5">
        <MetricGrid metrics={stats} className="grid-cols-4" />
      </GlassSurface>
      {activity.hrSamples && (
        <HrChart
          samples={activity.hrSamples}
          avgHr={activity.avgHeartRate}
          distanceKm={activity.distanceKm}
          onHoverFraction={activity.route ? setHoverFraction : undefined}
        />
      )}
      {hasSecondaryCharts && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activity.paceSamples && (
            <PaceChart
              samples={activity.paceSamples}
              avgPaceSecPerKm={activity.paceSecPerKm}
              distanceKm={activity.distanceKm}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
          {activity.cadenceSamples && (
            <CadenceChart
              samples={activity.cadenceSamples}
              avgCadence={activity.cadenceSpm}
              distanceKm={activity.distanceKm}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
          {activity.elevationProfile && (
            <ElevationChart
              samples={activity.elevationProfile}
              distanceKm={activity.distanceKm}
              elevationGain={activity.elevationGain}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
        </div>
      )}
    </>
  )
}
