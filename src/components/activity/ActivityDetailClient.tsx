'use client'

import type { ReactNode } from 'react'
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
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { useUrlParam } from '@/lib/useUrlParam'
import type { SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import { SimilarRuns } from './SimilarRuns'
import { ActivityNotes } from './ActivityNotes'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { activityPlanRow, type ActivityPlan } from './activityPlan'
import type { Insight } from '@/lib/gemini'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
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
  /** What the plan had that day, when it had something. */
  plan?: ActivityPlan | null
  similarRuns?: SimilarRunsData | null
  /** Race result and achievements, drawn after the note and before the tabs. */
  extras?: ReactNode
}

const TAB_IDS = ['overview', 'intervals', 'charts', 'dynamics'] as const
type TabId = (typeof TAB_IDS)[number]

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value)
}

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

export function ActivityDetailClient({
  activity,
  qualifiedEfforts,
  aiVerdict,
  shoe,
  dynamicsBaseline,
  plan = null,
  similarRuns = null,
  extras,
}: Props) {
  // The tab lives in ?tab=, so going back from Charts or Dynamics lands on it
  // again rather than on Overview.
  const [tabParam, setTabParam] = useUrlParam('tab')
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
  const tab: TabId = isTabId(tabParam) && tabs.some((item) => item.id === tabParam) ? tabParam : 'overview'
  const setTab = (next: TabId) => setTabParam(next === 'overview' ? null : next)
  const detailTabs = useSegmentedTabs({ ids: tabs.map((item) => item.id), value: tab, onChange: setTab })
  const planRow = plan ? activityPlanRow(activity, plan) : null
  const e = t.activity.effort

  return (
    <>
      {/* A compact map: the run's own numbers come first, and the map's
          fullscreen control is there to expand it. */}
      <div className="h-25 overflow-hidden rounded-card-sm border border-border">
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
          <NoRouteMap className="h-full min-h-0 w-full" />
        )}
      </div>

      <MetricGrid metrics={stats} className="grid-cols-4 px-1 text-center" />

      <RunVerdict activity={activity} aiVerdict={aiVerdict} planRow={planRow} />

      {!activity.avgHeartRate && (
        <p className="flex items-center justify-center gap-2 text-caption text-subtle-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.1] px-2 py-px font-mono text-caption font-semibold uppercase tracking-[0.1em] text-amber-600 dark:text-amber-400">
            {t.activity.dataQuality.estimated}
          </span>
          {t.activity.dataQuality.noHr}
        </p>
      )}

      {/* How it felt: the watch's RPE, read-only, and the note - the one thing
          on an activity the user writes. */}
      <GlassSurface variant="card" className="rounded-card-sm px-4">
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border text-sm">
          <span className="font-semibold text-foreground">
            <GlossaryTerm term="rpe">{e.label}</GlossaryTerm>
          </span>
          {activity.rpe !== null ? (
            <span className="text-foreground">{e.value(activity.rpe, t.rpeLabels[activity.rpe] ?? '')}</span>
          ) : (
            <span className="text-subtle">{e.notLogged}</span>
          )}
        </div>
        <ActivityNotes activityId={activity.id} />
      </GlassSurface>

      {extras}

      {tabs.length > 1 && (
        <div className="sticky top-[var(--top-scrim)] z-30 -mx-4 mb-3 px-4 pb-1 sm:-mx-6 sm:px-6">
          <SegmentedTabs
            tabs={detailTabs}
            items={tabs}
            label={t.activity.tabs.groupLabel}
            fill
            className="bg-background/85 backdrop-blur-md"
            tabClassName="h-9 text-footnote"
          />
        </div>
      )}

      {/* space-y-5 is the page's own rhythm: the panel stands in for the
          sections it holds, which used to be the page's direct children. */}
      <div {...(tabs.length > 1 ? detailTabs.panelProps : {})} className="space-y-5">
      {tab === 'overview' && (
        <>
          {activity.hrZones.length > 0 && (
            <ZoneBar hrZones={activity.hrZones} />
          )}
          {similarRuns && <SimilarRuns data={similarRuns} />}
          <TrainingEffect aer={activity.aerTrainingEffect} ana={activity.anaTrainingEffect} />
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
      </div>
    </>
  )
}
