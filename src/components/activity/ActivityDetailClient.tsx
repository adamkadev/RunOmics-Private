'use client'

import { useState } from 'react'
import type { Activity } from '@/domain/activity/types'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import { trimp, type HrBounds } from '@/domain/training/trimp'
import { heatAdjustmentSecondsPerKm, shouldAnnotateHeat } from '@/domain/training/heatAdjustment'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { RunVerdict } from './RunVerdict'
import { ZoneBar } from './ZoneBar'
import { HrChart } from './HrChart'
import { ElevationChart } from './ElevationChart'
import { PaceChart } from './PaceChart'
import { CadenceChart } from './CadenceChart'
import { KmSplits } from './KmSplits'
import { TrainingEffect } from './TrainingEffect'
import { BestEfforts } from './BestEfforts'
import { RunningDynamics } from './RunningDynamics'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { STATUS } from '@/lib/statusColors'

interface Props {
  activity: Activity
  hrBounds?: HrBounds
  qualifiedEfforts?: QualifiedEffort[]
}

type TabId = 'overview' | 'splits' | 'charts' | 'dynamics'

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

export function ActivityDetailClient({ activity, hrBounds, qualifiedEfforts }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const sessionTrimp = trimp(activity, hrBounds)
  const stats = buildStats(activity)
  const hasSecondaryCharts = !!(activity.elevationProfile || activity.paceSamples || activity.cadenceSamples)
  const hasCharts = hasSecondaryCharts || !!activity.hrSamples
  const hasSplits = !!(activity.splits && activity.splits.length > 0)
  const hasDynamics = !!(
    activity.strideLengthM != null ||
    activity.groundContactMs != null ||
    activity.verticalOscillationMm != null ||
    activity.verticalRatioPct != null
  )
  const heatAdjustSeconds =
    activity.paceSecPerKm && shouldAnnotateHeat(activity.avgTemperature)
      ? heatAdjustmentSecondsPerKm(activity.paceSecPerKm, activity.avgTemperature)
      : 0

  const tabs = [
    { id: 'overview' as const, label: t.activity.tabs.overview, show: true },
    { id: 'splits' as const, label: t.activity.tabs.splits, show: hasSplits },
    { id: 'charts' as const, label: t.activity.tabs.charts, show: hasCharts },
    { id: 'dynamics' as const, label: t.activity.tabs.dynamics, show: hasDynamics },
  ].filter((item) => item.show)

  return (
    <>
      <RunVerdict activity={activity} heatAdjustSeconds={heatAdjustSeconds} />

      <GlassSurface variant="card" className="p-5">
        <MetricGrid metrics={stats} className="grid-cols-4" />
        {sessionTrimp > 0 && (
          <div className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-subtle">
            <p>{t.activity.loadNote(Math.round(sessionTrimp / 7))}</p>
          </div>
        )}
      </GlassSurface>

      {tabs.length > 1 && (
        <GlassSurface
          as="div"
          variant="nav"
          role="tablist"
          aria-label={t.activity.tabs.groupLabel}
          className="sticky top-[max(var(--safe-top),8px)] z-10 flex gap-1 overflow-x-auto rounded-2xl mb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'relative min-w-fit flex-1 whitespace-nowrap px-2 py-3 text-sm font-medium transition-colors',
                tab === item.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              {tab === item.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-accent" />}
            </button>
          ))}
        </GlassSurface>
      )}

      {tab === 'overview' && (
        <>
          <div className="h-[clamp(220px,38vw,360px)] overflow-hidden rounded-card border border-border">
            {activity.route ? (
              <ActivityMapClient
                route={activity.route}
                paceSamples={activity.paceSamples}
                avgTemperature={activity.avgTemperature}
                className="h-full w-full"
              />
            ) : (
              <NoRouteMap className="h-full w-full" />
            )}
          </div>
          {activity.hrZones.length > 0 && <ZoneBar hrZones={activity.hrZones} />}
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />
          {activity.bestEfforts && (
            <BestEfforts bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />
          )}
        </>
      )}

      {tab === 'splits' && <KmSplits activity={activity} />}

      {tab === 'charts' && (
        <>
          {activity.hrSamples && (
            <>
              <p className="widget-label text-muted-foreground">{t.activity.charts.sectionPhysiology}</p>
              <HrChart samples={activity.hrSamples} avgHr={activity.avgHeartRate} distanceKm={activity.distanceKm} />
            </>
          )}
          {hasSecondaryCharts && (
            <>
              <p className="widget-label text-muted-foreground">{t.activity.charts.sectionPerformance}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activity.paceSamples && (
                  <PaceChart
                    samples={activity.paceSamples}
                    avgPaceSecPerKm={activity.paceSecPerKm}
                    distanceKm={activity.distanceKm}
                  />
                )}
                {activity.cadenceSamples && (
                  <CadenceChart
                    samples={activity.cadenceSamples}
                    avgCadence={activity.cadenceSpm}
                    distanceKm={activity.distanceKm}
                  />
                )}
                {activity.elevationProfile && (
                  <ElevationChart
                    samples={activity.elevationProfile}
                    distanceKm={activity.distanceKm}
                    elevationGain={activity.elevationGain}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'dynamics' && <RunningDynamics activity={activity} />}
    </>
  )
}
