'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { ActivityDetailView } from './activityViews'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import type { ShoeTag } from '@/domain/shoe/types'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { RunVerdict } from './RunVerdict'
import { ZoneBar } from './ZoneBar'
import { KmSplits } from './KmSplits'
import { TrainingEffect } from './TrainingEffect'
import { AerobicDecoupling } from './AerobicDecoupling'
import { BestEfforts } from './BestEfforts'
import { formatClock, formatDistance, formatDuration } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import type { Insight } from '@/lib/gemini'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Both tabs are closed when the page loads and draw with Recharts, so each
// loads the first time it is opened rather than with the page.
const tabLoading = () => <ChartCardSkeleton />
const ChartStack = dynamic(() => import('./ChartStack').then((m) => m.ChartStack), { loading: tabLoading })
const RunningDynamics = dynamic(() => import('./RunningDynamics').then((m) => m.RunningDynamics), { loading: tabLoading })

interface Props {
  activity: ActivityDetailView
  qualifiedEfforts?: QualifiedEffort[]
  aiVerdict: Insight | null
  shoe: ShoeTag | null
  dynamicsBaseline: DynamicsBaseline | null
}

type TabId = 'overview' | 'intervals' | 'charts' | 'dynamics'

function buildPrimaryStats(activity: ActivityDetailView): Metric[] {
  // MetricGrid has had a dedicated unit slot all along; this call site put the
  // unit in the label instead, which is why duration was the one stat with none.
  const stats: Metric[] = [
    {
      value: formatDistance(activity.distanceKm),
      unit: t.units.km,
      label: t.activity.stats.distance,
    },
    {
      value: formatDuration(activity.durationSeconds),
      label: t.activity.stats.duration,
    },
  ]

  if (activity.paceSecPerKm) {
    stats.push({
      value: formatClock(activity.paceSecPerKm),
      unit: t.units.perKm,
      label: t.activity.stats.pace,
    })
  }

  if (activity.avgHeartRate) {
    stats.push({
      value: `${activity.avgHeartRate}`,
      unit: t.units.bpm,
      label: t.activity.stats.avgHr,
    })
  }

  return stats
}

export function ActivityDetailClient({ activity, qualifiedEfforts, aiVerdict, shoe, dynamicsBaseline }: Props) {
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
    { id: 'intervals' as const, label: t.activity.tabs.intervals, show: hasSplits },
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

      <MetricGrid metrics={stats} className="grid-cols-4 px-1 text-center" />

      <RunVerdict activity={activity} aiVerdict={aiVerdict} />

      {!activity.avgHeartRate && (
        <p className="flex items-center justify-center gap-2 text-caption text-subtle-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.1] px-2 py-px font-mono text-micro font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
            {t.activity.dataQuality.estimated}
          </span>
          {t.activity.dataQuality.noHr}
        </p>
      )}

      {tabs.length > 1 && (
        <div className="sticky top-[var(--top-scrim)] z-30 -mx-4 mb-3 px-4 pb-1 sm:-mx-6 sm:px-6">
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
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />

          {activity.hrZones.length > 0 && (
            <ZoneBar
              hrZones={activity.hrZones}
              avgHr={activity.avgHeartRate}
              maxHr={activity.hrSamples ? Math.max(...activity.hrSamples) : null}
            />
          )}
          <AerobicDecoupling
            decoupling={aerobicDecoupling(activity)}
            onShowCharts={hasCharts ? () => setTab('charts') : undefined}
          />
          {activity.bestEfforts && (
            <BestEfforts bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />
          )}
        </>
      )}

      {tab === 'intervals' && <KmSplits activity={activity} />}

      {tab === 'charts' && (
        <ChartStack
          distanceKm={activity.distanceKm}
          hrSamples={activity.hrSamples}
          avgHr={activity.avgHeartRate}
          paceSamples={activity.paceSamples}
          avgPaceSecPerKm={activity.paceSecPerKm}
          cadenceSamples={activity.cadenceSamples}
          avgCadence={activity.cadenceSpm}
          elevationProfile={activity.elevationProfile}
          elevationGain={activity.elevationGain}
        />
      )}

      {tab === 'dynamics' && <RunningDynamics activity={activity} baseline={dynamicsBaseline} />}
    </>
  )
}
