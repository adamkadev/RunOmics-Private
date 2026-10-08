'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { ActivityDetailView } from './activityViews'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { RunVerdict } from './RunVerdict'
import { RunEffortCard } from './RunEffortCard'
import { KmSplits } from './KmSplits'
import { BestEfforts } from './BestEfforts'
import type { ChartZones } from './chartStackLanes'
import { formatClock, formatDistance, formatDuration } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { StickyBar } from '@/components/ui/StickyBar'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Stat } from '@/components/ui/Stat'
import { useUrlParam } from '@/lib/useUrlParam'
import { isStuck, restingTop, useStuck } from '@/lib/useStuck'
import { cn } from '@/lib/utils'
import type { SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import { SimilarRuns } from './SimilarRuns'
import { ActivityNotes } from './ActivityNotes'
import { conditionsText, garminActivityUrl } from './runConditions'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import type { ShoeTag } from '@/domain/shoe/types'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

// Both tabs are closed when the page loads, so each loads the first time it
// is opened rather than with the page.
const tabLoading = () => <ChartCardSkeleton />
const ChartStack = dynamic(() => import('./ChartStack').then((m) => m.ChartStack), { loading: tabLoading })
const RunningDynamics = dynamic(() => import('./RunningDynamics').then((m) => m.RunningDynamics), { loading: tabLoading })

interface Props {
  activity: ActivityDetailView
  qualifiedEfforts?: QualifiedEffort[]
  aiVerdict: Insight | null
  dynamicsBaseline: DynamicsBaseline | null
  /** The pair it was run in, as the Shoe row of the verdict card. */
  shoe?: ShoeTag | null
  similarRuns?: SimilarRunsData | null
  /** Race result and achievements, at the head of Overview. */
  extras?: ReactNode
  /** Back, title, subtitle and share: the same on every tab. */
  header?: ReactNode
  /** The athlete's zones, banded behind the Charts lanes. */
  chartZones?: ChartZones | null
}

const TAB_IDS = ['overview', 'intervals', 'charts', 'dynamics'] as const
type TabId = (typeof TAB_IDS)[number]

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value)
}

interface PrimaryStat {
  label: string
  value: string
  unit?: string
}

function buildPrimaryStats(activity: ActivityDetailView): PrimaryStat[] {
  const s = t.activity.stats
  const stats: PrimaryStat[] = [
    { label: s.distance, value: formatDistance(activity.distanceKm), unit: t.units.km },
    { label: s.duration, value: formatDuration(activity.durationSeconds) },
  ]
  if (activity.paceSecPerKm) stats.push({ label: s.pace, value: formatClock(activity.paceSecPerKm), unit: t.units.perKm })
  if (activity.avgHeartRate) stats.push({ label: s.avgHr, value: `${activity.avgHeartRate}`, unit: t.units.bpm })
  return stats
}

/** "Very Easy" as "Very easy": the detail rows are in sentence case (v4.17). */
function sentenceCase(label: string): string {
  return label ? label.charAt(0) + label.slice(1).toLowerCase() : label
}

/**
 * The run's four numbers on one line, under the tabs while they are pinned
 * (design review, Oct 2026): the map card has scrolled away by then, and
 * which run this is should survive a tab switch. It echoes the card, which a
 * screen reader has read already, so it is hidden from one. It is drawn over
 * what has scrolled under the strip, so it never moves the page.
 */
function RunSummary({ stats }: { stats: PrimaryStat[] }) {
  return (
    <div
      aria-hidden="true"
      data-testid="run-summary"
      className="flex h-7 animate-[fade-in_150ms_ease-out] items-end justify-between gap-3 px-1 text-footnote text-muted-foreground"
    >
      {stats.map((stat) => (
        <span key={stat.label} className="whitespace-nowrap">
          <span className="font-semibold text-foreground">{stat.value}</span>
          {stat.unit && ` ${stat.unit}`}
        </span>
      ))}
    </div>
  )
}

/** A detail row of the verdict card: the name muted on the left, the value in ink on the right. */
const ROW = 'flex min-h-11 items-center justify-between gap-3 border-t border-border text-sm'

export function ActivityDetailClient({
  activity,
  qualifiedEfforts,
  aiVerdict,
  dynamicsBaseline,
  shoe = null,
  similarRuns = null,
  extras,
  header,
  chartZones = null,
}: Props) {
  // The tab lives in ?tab=, so going back from Charts or Dynamics lands on it
  // again rather than on Overview.
  const [tabParam, setTabParam] = useUrlParam('tab')
  const stats = buildPrimaryStats(activity)
  const stripRef = useRef<HTMLDivElement>(null)
  const pinned = useStuck(stripRef)
  // Whether the strip was pinned when a tab was picked, until the new tab is drawn.
  const switchRef = useRef<{ pinned: boolean } | null>(null)
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
  const setTab = (next: TabId) => {
    if (next === tab) return
    switchRef.current = { pinned: stripRef.current ? isStuck(stripRef.current) : false }
    setTabParam(next === 'overview' ? null : next)
  }
  const detailTabs = useSegmentedTabs({ ids: tabs.map((item) => item.id), value: tab, onChange: setTab })
  const e = t.activity.effort

  // A tab picked with the strip pinned keeps it pinned, the new tab from its
  // top; one picked lower down never opens the new tab under the strip. The
  // map and the verdict leave or come back above the strip on a switch, which
  // otherwise left the reader partway down the new tab.
  useLayoutEffect(() => {
    const switched = switchRef.current
    switchRef.current = null
    const strip = stripRef.current
    if (!switched || !strip) return
    const pinnedAt = restingTop(strip) - (parseFloat(getComputedStyle(strip).top) || 0)
    if (switched.pinned || window.scrollY > pinnedAt) window.scrollTo({ top: Math.max(0, pinnedAt), behavior: 'instant' })
  }, [tab])

  return (
    <>
      {header}

      {/* The route and its four numbers in one card (v4.17), the route 320
          pt tall in the accent. The map is Overview's: on Splits, Charts and
          Dynamics it pushed the tab's own content off the first screen, so
          it collapses there and the four numbers stay (design review, Oct
          2026). */}
      <section className={cardClass({ padding: 'none', overflow: true })} data-testid="run-map-card">
        {tab === 'overview' && (
          <div className="h-[260px] border-b border-border sm:h-[320px]" data-testid="run-map">
            {activity.route ? (
              <ActivityMapClient route={activity.route} className="h-full min-h-0 w-full rounded-none" />
            ) : (
              <NoRouteMap className="h-full min-h-0 w-full rounded-none border-0" />
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} unit={stat.unit} valueStyle={{ fontSize: 24 }} />
          ))}
        </div>
      </section>

      {/* The verdict and how it felt - the watch's RPE, the conditions, the
          pair and the note, the one thing here the user writes - in one card
          (H10), heading Overview; the other tabs go straight to their content. */}
      {tab === 'overview' && (
        <RunVerdict activity={activity} aiVerdict={aiVerdict}>
          {!activity.avgHeartRate && (
            <div className={ROW}>
              <span className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--warn)]">
                {t.activity.dataQuality.estimated}
              </span>
            </div>
          )}
          <div className={ROW}>
            <span className="text-muted-foreground">
              <GlossaryTerm term="rpe">{e.label}</GlossaryTerm>
            </span>
            {activity.rpe !== null ? (
              <span className="text-foreground">{e.value(activity.rpe, sentenceCase(t.rpeLabels[activity.rpe] ?? ''))}</span>
            ) : (
              <span className="text-subtle">{e.notLogged}</span>
            )}
          </div>
          {/* Effort · Conditions · Shoe · Note (v4.8 2h): the weather and the
              pair explain effort and heart rate, so they sit with them. */}
          {activity.weather && (
            <div className={ROW} data-testid="run-conditions">
              <span className="text-muted-foreground">{t.activity.conditions.label}</span>
              <span className="text-foreground">{conditionsText(activity.weather)}</span>
            </div>
          )}
          {/* The pair comes from Garmin, so it is set and changed there. */}
          <a
            href={garminActivityUrl(activity.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={shoe ? t.activity.shoe.changeInGarmin(shoe.name) : t.activity.shoe.addInGarmin}
            className={ROW}
            data-testid="run-shoe"
          >
            <span className="text-muted-foreground">{t.activity.shoe.label}</span>
            {shoe ? (
              <span className="min-w-0 truncate text-foreground">{shoe.name} ›</span>
            ) : (
              <span className="font-medium text-accent-text">{t.activity.shoe.add} ›</span>
            )}
          </a>
          <ActivityNotes activityId={activity.id} />
        </RunVerdict>
      )}

      {/* Directly under the compact title bar once pinned (design review,
          Oct 2026), the run's one-line summary under it. The summary's
          28 pt are taken back from the margin, so the page under the strip
          does not move when it shows. */}
      {tabs.length > 1 && (
        <StickyBar ref={stripRef} top="var(--sticky-top, var(--top-scrim))" className={cn('-mb-2', pinned && '-mb-9')}>
          <SegmentedTabs
            tabs={detailTabs}
            items={tabs}
            label={t.activity.tabs.groupLabel}
            size="md"
            fill
            tabClassName="h-[34px] text-[13px]"
          />
          {pinned && <RunSummary stats={stats} />}
        </StickyBar>
      )}

      {/* The panel stands in for the cards it holds, 14 pt apart like the
          page's own. */}
      <div {...(tabs.length > 1 ? detailTabs.panelProps : {})} className="flex flex-col gap-3.5 outline-none">
        {tab === 'overview' && (
          <>
            {extras}
            <RunEffortCard
              hrZones={activity.hrZones}
              aer={activity.aerTrainingEffect}
              ana={activity.anaTrainingEffect}
              decoupling={aerobicDecoupling(activity)}
              onShowCharts={hasCharts ? () => setTab('charts') : undefined}
            />
            {similarRuns && <SimilarRuns data={similarRuns} />}
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
            zones={chartZones}
          />
        )}

        {tab === 'dynamics' && <RunningDynamics activity={activity} baseline={dynamicsBaseline} />}
      </div>
    </>
  )
}
