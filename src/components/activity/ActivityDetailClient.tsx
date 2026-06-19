'use client'

import { useState } from 'react'
import { Footprints, Timer, TrendingUp, Heart, Mountain, Flame, Gauge, Zap, type LucideIcon } from 'lucide-react'
import type { Activity } from '@/domain/activity/types'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { HrChart } from './HrChart'
import { ElevationChart } from './ElevationChart'
import { PaceChart } from './PaceChart'
import { CadenceChart } from './CadenceChart'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const TYPE_ACCENT: Record<string, string> = {
  Sprint: 'fuchsia', Anaerobic: 'purple', VO2Max: 'red',
  Threshold: 'orange', Tempo: 'yellow', Base: 'green', Race: 'amber',
}

interface Props {
  activity: Activity
}

interface StatDef {
  Icon: LucideIcon
  color: string
  value: string
  label: string
}

function buildStats(activity: Activity): StatDef[] {
  const stats: StatDef[] = [
    {
      Icon: Footprints,
      color: 'text-emerald-500 dark:text-emerald-400',
      value: formatDistance(activity.distanceKm),
      label: t.activity.stats.distance,
    },
    {
      Icon: Timer,
      color: 'text-blue-500 dark:text-blue-400',
      value: formatDuration(activity.durationSeconds),
      label: t.activity.stats.duration,
    },
  ]

  if (activity.paceSecPerKm) {
    stats.push({
      Icon: TrendingUp,
      color: 'text-violet-500 dark:text-violet-400',
      value: formatPace(activity.paceSecPerKm),
      label: t.activity.stats.avgPace,
    })
  }

  if (activity.avgHeartRate) {
    stats.push({
      Icon: Heart,
      color: 'text-red-500 dark:text-red-400',
      value: `${activity.avgHeartRate} ${t.units.bpm}`,
      label: t.activity.stats.avgHr,
    })
  }

  if (activity.calories != null) {
    stats.push({
      Icon: Flame,
      color: 'text-orange-500 dark:text-orange-400',
      value: t.activity.stats.caloriesValue(activity.calories),
      label: t.activity.stats.calories,
    })
  }

  if (activity.elevationGain) {
    stats.push({
      Icon: Mountain,
      color: 'text-stone-500 dark:text-stone-400',
      value: t.activity.stats.elevationValue(activity.elevationGain),
      label: t.activity.stats.elevation,
    })
  }

  if (activity.cadenceSpm != null) {
    stats.push({
      Icon: Gauge,
      color: 'text-sky-500 dark:text-sky-400',
      value: `${Math.round(activity.cadenceSpm)} ${t.units.spm}`,
      label: t.activity.stats.cadence,
    })
  }

  stats.push({
    Icon: Zap,
    color: 'text-amber-500 dark:text-amber-400',
    value: activity.rpe !== null ? (t.rpeLabels[activity.rpe] ?? '-') : t.activity.stats.na,
    label: activity.rpe !== null ? t.activity.stats.rpeValue(activity.rpe) : t.activity.stats.rpe,
  })

  return stats
}

export function ActivityDetailClient({ activity }: Props) {
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)
  const stats = buildStats(activity)
  const hasCharts = !!(activity.hrSamples || activity.elevationProfile || activity.paceSamples || activity.cadenceSamples)

  return (
    <>
      <Card accent={TYPE_ACCENT[activity.type]} padding="none" overflow>
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

        <div className="grid grid-cols-4 px-2 py-2">
          {stats.map(({ Icon, color, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-2 text-center">
              <Icon size={13} className={color} />
              <div className="whitespace-nowrap text-sm font-bold leading-tight text-foreground">{value}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
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
