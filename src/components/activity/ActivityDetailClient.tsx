'use client'

import { useState } from 'react'
import type { Activity } from '@/domain/activity/types'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { HrBounds } from '@/domain/training/trimp'
import type { ShoeTag } from '@/domain/shoe/types'
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
import { AerobicDecoupling } from './AerobicDecoupling'
import { BestEfforts } from './BestEfforts'
import { RunningDynamics } from './RunningDynamics'
import { formatClock, formatDistance, formatDurationShort } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import type { Insight } from '@/lib/gemini'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  activity: Activity
  hrBounds?: HrBounds
  qualifiedEfforts?: QualifiedEffort[]
  aiVerdict: Insight | null
  shoe: ShoeTag | null
}

type TabId = 'overview' | 'splits' | 'charts' | 'dynamics'


// The primary stat row is capped at the 4 numbers the mockup specifies
// (distance/time/pace/HR) - everything else becomes secondary stats inside
// the Overview tab instead of wrapping the header row onto a second line.
function buildPrimaryStats(activity: Activity): Metric[] {
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

  return stats
}


export function ActivityDetailClient({ activity, qualifiedEfforts, aiVerdict, shoe }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const stats = buildPrimaryStats(activity)
  const hasSecondaryCharts = !!(activity.elevationProfile || activity.paceSamples || activity.cadenceSamples)
  const hasCharts = hasSecondaryCharts || !!activity.hrSamples
  const hasSplits = !!(activity.splits && activity.splits.length > 0)
  const hasDynamics = !!(
    activity.strideLengthM != null ||
    activity.groundContactMs != null ||
    activity.verticalOscillationMm != null ||
    activity.verticalRatioPct != null
  )

  const tabs = [
    { id: 'overview' as const, label: t.activity.tabs.overview, show: true },
    { id: 'splits' as const, label: t.activity.tabs.splits, show: hasSplits },
    { id: 'charts' as const, label: t.activity.tabs.charts, show: hasCharts },
    { id: 'dynamics' as const, label: t.activity.tabs.dynamics, show: hasDynamics },
  ].filter((item) => item.show)

  return (
    <>
      <div className="h-[clamp(220px,38vw,360px)] overflow-hidden rounded-card border border-border">
        {activity.route ? (
          <ActivityMapClient
            route={activity.route}
            paceSamples={activity.paceSamples}
            weather={activity.weather}
            activityType={activity.type}
            shoe={shoe}
            className="h-full w-full"
          />
        ) : (
          <NoRouteMap className="h-full w-full" />
        )}
      </div>

      <RunVerdict activity={activity} aiVerdict={aiVerdict} />

      <MetricGrid metrics={stats} className="grid-cols-4 px-1 text-center" />

      {!activity.avgHeartRate && (
        <p className="flex items-center justify-center gap-2 text-caption text-subtle-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.1] px-2 py-px font-mono text-micro font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
            {t.activity.dataQuality.estimated}
          </span>
          {t.activity.dataQuality.noHr}
        </p>
      )}

      {tabs.length > 1 && (
        <div className="sticky top-[max(var(--safe-top),8px)] z-10 -mx-4 mb-3 px-4 pb-1 sm:-mx-6 sm:px-6">
          <GlassSurface
            as="div"
            variant="card"
            role="tablist"
            aria-label={t.activity.tabs.groupLabel}
            className="flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'min-w-fit flex-1 whitespace-nowrap rounded-full py-2.5 text-sm font-semibold transition-colors',
                  tab === item.id ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </GlassSurface>
        </div>
      )}

      {tab === 'overview' && (
        <>
          {activity.hrZones.length > 0 && (
            <ZoneBar
              hrZones={activity.hrZones}
              avgHr={activity.avgHeartRate}
              maxHr={activity.hrSamples ? Math.max(...activity.hrSamples) : null}
            />
          )}
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />
          <AerobicDecoupling decoupling={aerobicDecoupling(activity)} />
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
