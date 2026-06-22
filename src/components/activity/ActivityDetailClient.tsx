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
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface Props {
  activity: Activity
}

interface StatDef {
  value: string
  unit: string
}

function buildStats(activity: Activity): StatDef[] {
  const stats: StatDef[] = [
    {
      value: formatDistance(activity.distanceKm),
      unit: t.units.km,
    },
    {
      value: formatDurationShort(activity.durationSeconds),
      unit: t.activity.stats.duration,
    },
  ]

  if (activity.paceSecPerKm) {
    stats.push({
      value: formatClock(activity.paceSecPerKm),
      unit: t.units.perKm,
    })
  }

  if (activity.avgHeartRate) {
    stats.push({
      value: `${activity.avgHeartRate}`,
      unit: t.units.bpm,
    })
  }

  if (activity.calories != null) {
    stats.push({
      value: `${activity.calories}`,
      unit: t.units.kcal
    })
  }

  if (activity.elevationGain !== null) {
    stats.push({
      value: `${activity.elevationGain > 0 ? '+' : '-'}${Math.abs(activity.elevationGain)}`,
      unit: t.units.elevation,
    })
  }

  if (activity.cadenceSpm != null) {
    stats.push({
      value: `${Math.round(activity.cadenceSpm)}`,
      unit: t.units.spm,
    })
  }

  stats.push({
    value: activity.rpe !== null ? t.activity.stats.rpeValue(activity.rpe) : t.activity.stats.rpe,
    unit: activity.rpe !== null ? (t.rpeLabels[activity.rpe] ?? '-') : t.activity.stats.na,
  })

  return stats
}

export function ActivityDetailClient({ activity }: Props) {
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)
  const stats = buildStats(activity)
  const hasCharts = !!(activity.hrSamples || activity.elevationProfile || activity.paceSamples || activity.cadenceSamples)

  return (
    <>
      <Card padding="none" overflow>
        <div className="h-[260px] overflow-hidden rounded-t-xl sm:h-[360px]">
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
      </Card>

      <Card padding="none" overflow>
        <div className="flex flex-wrap justify-center px-2 py-2">
          {stats.map(({ value, unit }, i) => (
            <div
              key={i}
              className="flex min-w-[5rem] flex-1 flex-col items-start gap-0.5 px-2 py-2"
            >
              <div className={cn(
                'whitespace-nowrap font-bold leading-tight text-foreground',
                i === stats.length - 1 && 'text-accent-text'
              )}>
                {value}
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {unit}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {hasCharts && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {activity.hrSamples && (
            <HrChart
              samples={activity.hrSamples}
              avgHr={activity.avgHeartRate}
              distanceKm={activity.distanceKm}
              onHoverFraction={activity.route ? setHoverFraction : undefined}
            />
          )}
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
