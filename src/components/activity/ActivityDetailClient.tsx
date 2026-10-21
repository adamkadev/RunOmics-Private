'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { ActivityDetailView } from './activityViews'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import type { QualifiedEffort } from '@/application/usecases/GetRecords'
import type { DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { RunMapHero } from './RunMapHero'
import { RunVerdict, RUN_CHIP_CLASS } from './RunVerdict'
import { RunEffortCard } from './RunEffortCard'
import { PaceHrPreview } from './PaceHrPreview'
import { KmSplits } from './KmSplits'
import { BestEfforts } from './BestEfforts'
import { RunPlace } from './RunPlace'
import type { ChartZones } from './chartStackLanes'
import { formatClock, formatDistance, formatDuration, formatDurationRounded } from '@/lib/formatters'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { StickyBar } from '@/components/ui/StickyBar'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TypeDot } from '@/components/ui/TypeDot'
import { useUrlParam } from '@/lib/useUrlParam'
import { isStuck, restingTop } from '@/lib/useStuck'
import { cn } from '@/lib/utils'
import type { SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import { SimilarRuns } from './SimilarRuns'
import { ActivityNotes } from './ActivityNotes'
import { conditionsText, garminActivityUrl } from './runConditions'
import { isWatchId } from '@/lib/garminConnect'
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
  /** The run's name: the title under the map. */
  name: string
  /** The run's date as the page shows it, in the line over the title. */
  dateLabel: string
  /** The watch's own comment, under the title. */
  comment?: string
  qualifiedEfforts?: QualifiedEffort[]
  aiVerdict: Insight | null
  dynamicsBaseline: DynamicsBaseline | null
  /** The pair it was run in, as the shoe chip of the verdict card. */
  shoe?: ShoeTag | null
  similarRuns?: SimilarRunsData | null
  /** Race result and achievements, at the head of Overview. */
  extras?: ReactNode
  /** The way back and Share, floating on the map. */
  back?: ReactNode
  share?: ReactNode
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

/** The fullscreen map's card (3.0): distance, time, pace and the climb. */
function buildMapStats(activity: ActivityDetailView): PrimaryStat[] {
  const s = t.activity.map.stats
  const stats: PrimaryStat[] = [
    { label: s.distance, value: formatDistance(activity.distanceKm), unit: t.units.km },
    { label: s.time, ...formatDurationRounded(activity.durationSeconds) },
  ]
  if (activity.paceSecPerKm) stats.push({ label: s.pace, value: formatClock(activity.paceSecPerKm), unit: t.units.perKm })
  if (activity.elevationGain != null) stats.push({ label: s.elevation, value: `+${Math.round(activity.elevationGain)}`, unit: t.units.m })
  return stats
}

function buildPrimaryStats(activity: ActivityDetailView): PrimaryStat[] {
  const s = t.activity.stats
  const stats: PrimaryStat[] = [
    { label: s.distance, value: formatDistance(activity.distanceKm), unit: t.units.km },
    // The time unitless (F8): "59:35 min" all but touched the pace beside
    // it, and m:ss or h:mm:ss says what it is.
    { label: s.duration, value: formatDuration(Math.round(activity.durationSeconds)) },
  ]
  if (activity.paceSecPerKm) stats.push({ label: s.pace, value: formatClock(activity.paceSecPerKm), unit: t.units.perKm })
  if (activity.avgHeartRate) stats.push({ label: s.avgHr, value: `${activity.avgHeartRate}`, unit: t.units.bpm })
  return stats
}

function StatStrip({ stats, testId = 'run-stats' }: { stats: PrimaryStat[]; testId?: string }) {
  return (
    // Four equal columns 8 pt apart (F8), each number free to shrink.
    <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2" data-testid={testId}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
          <span className="whitespace-nowrap text-[22px] font-bold leading-7 tracking-[-0.016rem] text-foreground">
            {stat.value}
            {stat.unit && <span className="ml-0.5 text-[13px] font-normal tracking-normal text-muted-foreground">{stat.unit}</span>}
          </span>
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ActivityDetailClient({
  activity,
  name,
  dateLabel,
  comment,
  qualifiedEfforts,
  aiVerdict,
  dynamicsBaseline,
  shoe = null,
  similarRuns = null,
  extras,
  back,
  share,
  chartZones = null,
}: Props) {
  // The tab lives in ?tab=, so going back from Charts or Dynamics lands on it
  // again rather than on Overview.
  const [tabParam, setTabParam] = useUrlParam('tab')
  const stats = buildPrimaryStats(activity)
  const stripRef = useRef<HTMLDivElement>(null)
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
  // top; one picked lower down never opens the new tab under the strip.
  // Everything above the tabs is the same on every tab (3.0), so the reader
  // stays below the hero.
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
      {/* Map first, edge to edge, then the run's name, its four numbers and
          the verdict, the tabs right under it (3.0). The same on every tab,
          so a tab switch keeps the page under the hero where it was. */}
      <RunMapHero
        route={activity.route ?? null}
        back={back}
        share={share}
        card={
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[17px] font-bold text-foreground">{name}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground">{dateLabel}</span>
            </div>
            <StatStrip stats={buildMapStats(activity)} testId="map-card-stats" />
          </div>
        }
      />

      <header className="-mt-1 flex flex-col gap-1">
        {/* Type · date · town: the type as its dot and its name. Above the
            title, it fades as it nears the compact bar. */}
        <p data-title-sub className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-5 text-muted-foreground" data-testid="activity-subtitle">
          <TypeDot type={activity.type} />
          {t.activityTypes[activity.type]}
          <span aria-hidden>·</span>
          {dateLabel}
          <RunPlace activityId={activity.id} start={activity.route?.[0] ?? null} />
        </p>
        <h1 data-title-late className="text-display text-foreground">
          {name}
        </h1>
        {/* Under the title too, so it fades with the date line rather than
            show cut under the compact title bar. */}
        {comment && (
          <p data-title-sub className="text-sm text-muted-foreground">{comment}</p>
        )}
      </header>

      <StatStrip stats={stats} />

      {/* The verdict, then how it felt - the watch's RPE, the conditions, the
          pair and the note, the one thing here the user writes - as chips
          (3.0): four full-width rows pushed the tabs a screen down. */}
      <RunVerdict activity={activity} aiVerdict={aiVerdict}>
        {!activity.avgHeartRate && (
          <span className={cn(RUN_CHIP_CLASS, 'font-semibold text-[var(--warn)]')}>{t.activity.dataQuality.estimated}</span>
        )}
        <span className={RUN_CHIP_CLASS} data-testid="run-effort">
          {activity.rpe !== null ? t.activities.row.rpeValue(activity.rpe) : `${e.label} ${e.notLogged}`}
        </span>
        {/* The weather and the pair explain effort and heart rate, so they
            sit with them (v4.8 2h). No wind reading, no wind. */}
        {activity.weather && (
          <span className={RUN_CHIP_CLASS} data-testid="run-conditions">{conditionsText(activity.weather)}</span>
        )}
        {/* The pair is set on the watch, so the chip opens its app - but
            only for a run the watch gave an id to; otherwise there is
            nothing at the other end, so the pair just reads (3.0 override 1). */}
        {isWatchId(activity.id) ? (
          <a
            href={garminActivityUrl(activity.id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={shoe ? t.activity.shoe.changeInGarmin(shoe.name) : t.activity.shoe.addInGarmin}
            className={cn(RUN_CHIP_CLASS, !shoe && 'font-medium text-accent-text')}
            data-testid="run-shoe"
          >
            <span className="truncate">{shoe ? shoe.name : t.activity.shoe.add}</span>
          </a>
        ) : (
          shoe && (
            <span className={RUN_CHIP_CLASS} data-testid="run-shoe">
              <span className="truncate">{shoe.name}</span>
            </span>
          )
        )}
        <ActivityNotes activityId={activity.id} />
      </RunVerdict>

      {/* Straight after the verdict, pinned under the compact title bar once
          it reaches it. */}
      {tabs.length > 1 && (
        <StickyBar ref={stripRef} top="var(--sticky-top, var(--top-scrim))" className="-mb-2">
          <SegmentedTabs
            tabs={detailTabs}
            items={tabs}
            label={t.activity.tabs.groupLabel}
            size="md"
            fill
          />
        </StickyBar>
      )}

      {/* The panel stands in for the cards it holds, 14 pt apart like the
          page's own. On a phone it is at least a screen less the bars, the
          strip and the page's foot tall (3.0.2): a short tab - one Splits
          card - left the page too short to scroll the strip up to the title
          bar, so it stopped a little below it with a sliver of the card
          above showing between them. */}
      <div
        {...(tabs.length > 1 ? detailTabs.panelProps : {})}
        className={cn(
          'flex flex-col gap-3.5 outline-none',
          tabs.length > 1 && 'max-lg:min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom)_-_15rem)]',
        )}
        data-testid="activity-panel"
      >
        {tab === 'overview' && (
          <>
            {extras}
            <PaceHrPreview
              paceSamples={activity.paceSamples}
              hrSamples={activity.hrSamples}
              distanceKm={activity.distanceKm}
              onShowCharts={hasCharts ? () => setTab('charts') : undefined}
            />
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
