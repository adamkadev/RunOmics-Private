'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ActivityDetailView } from './activityViews'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { RunVerdict } from './RunVerdict'
import { ZoneBar } from './ZoneBar'
import { KmSplits } from './KmSplits'
import { TrainingEffect } from './TrainingEffect'
import { AerobicDecoupling } from './AerobicDecoupling'
import { BestEfforts } from './BestEfforts'
import { formatClock, formatDistance, formatDuration } from '@/lib/formatters'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { StickyBar } from '@/components/ui/StickyBar'
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
  dynamicsBaseline: DynamicsBaseline | null
  /** What the plan had that day, when it had something. */
  plan?: ActivityPlan | null
  similarRuns?: SimilarRunsData | null
  /** Race result and achievements, drawn after the note and before the tabs. */
  extras?: ReactNode
  /** Back and share, title and subtitle: drawn on Overview only. */
  header?: ReactNode
  /** "Threshold · Fri, Sep 25": the one line the other tabs keep above them. */
  compactTitle?: string
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
  dynamicsBaseline,
  plan = null,
  similarRuns = null,
  extras,
  header,
  compactTitle,
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
      {/* The run itself - map, numbers, verdict, how it felt - heads Overview.
          The other tabs keep one line of it, so their first chart is not
          pushed below the fold by a page that repeats above each of them. */}
      {tab === 'overview' || !compactTitle ? (
        <>
          {header}
          {/* About a quarter of the screen, fitted to the route: the v4 strip
              (F04) left the route a squiggle under four chips. */}
          <div className="h-[210px] overflow-hidden rounded-card-sm border border-border">
            {activity.route ? (
              <ActivityMapClient
                route={activity.route}
                paceSamples={activity.paceSamples}
                weather={activity.weather}
                className="h-full w-full"
              />
            ) : (
              <NoRouteMap className="h-full min-h-0 w-full" />
            )}
          </div>

          <MetricGrid metrics={stats} className="grid-cols-4 px-1 text-center" />

          {/* The verdict, the plan, and how it felt - the watch's RPE and the
              note, the one thing here the user writes - in one card (H10). */}
          <RunVerdict activity={activity} aiVerdict={aiVerdict} planRow={planRow}>
            {!activity.avgHeartRate && (
              <div className="pt-2.5">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.1] px-2 py-px text-caption font-semibold uppercase tracking-[0.06em] text-amber-600 dark:text-amber-400">
                  {t.activity.dataQuality.estimated}
                </span>
              </div>
            )}
            <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
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
          </RunVerdict>

          {extras}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setTab('overview')}
          data-testid="compact-header"
          className="flex min-h-11 items-center gap-1.5 text-left font-display text-title3 font-bold text-foreground"
        >
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          <span className="truncate">{compactTitle}</span>
        </button>
      )}

      {tabs.length > 1 && (
        <StickyBar top="var(--top-scrim)" className="mb-3">
          <SegmentedTabs
            tabs={detailTabs}
            items={tabs}
            label={t.activity.tabs.groupLabel}
            fill
            tabClassName="h-9 text-footnote"
          />
        </StickyBar>
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
