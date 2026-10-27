'use client'

import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { ActivityDetailView } from './activityViews'
import type { ActivityType } from '@/domain/activity/types'
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
import { formatClock, formatDistance, formatDurationRounded } from '@/lib/formatters'
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
import { conditionsChips, garminActivityUrl } from './runConditions'
import { isWatchId } from '@/lib/garminConnect'
import { RunShoe, type ShoeOption } from './RunShoe'
import type { Insight } from '@/lib/gemini'
import { t } from '@/i18n'

// Both tabs are closed when the page loads, so each loads the first time it
// is opened rather than with the page.
const tabLoading = () => <ChartCardSkeleton />
const ChartStack = dynamic(() => import('./ChartStack').then((m) => m.ChartStack), { loading: tabLoading })
const RunningDynamics = dynamic(() => import('./RunningDynamics').then((m) => m.RunningDynamics), { loading: tabLoading })

interface Props {
  activity: ActivityDetailView
  name: string
  /** Its session's type, where it has one. */
  shownType?: ActivityType
  dateLabel: string
  /** The watch's own comment. */
  comment?: string
  qualifiedEfforts?: QualifiedEffort[]
  aiVerdict: Insight | null
  dynamicsBaseline: DynamicsBaseline | null
  shoe?: (ShoeOption & { source?: 'choice' | 'default' }) | null
  /** The active shoes the owner can pick for this run. */
  shoeOptions?: ShoeOption[]
  similarRuns?: SimilarRunsData | null
  extras?: ReactNode
  /** Inside the panel, so a short tab's height falls below it, not between it and the content. */
  footer?: ReactNode
  back?: ReactNode
  share?: ReactNode
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
    // As the share card reads it: h:mm from an hour, m:ss under; h:mm:ss took too much of the row.
    { label: s.duration, ...formatDurationRounded(activity.durationSeconds) },
  ]
  if (activity.paceSecPerKm) stats.push({ label: s.pace, value: formatClock(activity.paceSecPerKm), unit: t.units.perKm })
  if (activity.avgHeartRate) stats.push({ label: s.avgHr, value: `${activity.avgHeartRate}`, unit: t.units.bpm })
  return stats
}

/**
 * 28 pt where its column allows, else what fits h:mm:ss (3.65 em at 700) in
 * one of four columns 8 pt apart: (100cqi - 24px) / 4 / 3.65.
 */
const STAT_VALUE_SIZE = 'text-[length:min(28px,calc((100cqi_-_24px)_/_14.6))]'

function StatStrip({ stats, testId = 'run-stats' }: { stats: PrimaryStat[]; testId?: string }) {
  return (
    // A fixed 44 pt value row, so a unit's taller inline box cannot lift its
    // neighbours; column flow keeps each value before its label for VoiceOver.
    <div
      className="grid grid-flow-col grid-cols-[repeat(4,minmax(0,1fr))] grid-rows-[44px_auto] gap-x-2 gap-y-0.5 [container-type:inline-size]"
      data-testid={testId}
    >
      {stats.map((stat) => (
        <Fragment key={stat.label}>
          <span
            data-stat-value
            className={cn(
              'block h-8 min-w-0 self-end whitespace-nowrap font-bold tracking-[-0.02em] text-foreground',
              STAT_VALUE_SIZE,
              'leading-8',
            )}
          >
            {stat.value}
            {stat.unit && <span className="ml-[3px] text-[14px] font-normal leading-none tracking-normal text-muted-foreground">{stat.unit}</span>}
          </span>
          <span data-stat-label className="min-w-0 truncate text-[15px] leading-5 text-muted-foreground">{stat.label}</span>
        </Fragment>
      ))}
    </div>
  )
}

const NO_SHOES: ShoeOption[] = []

export function ActivityDetailClient({
  activity,
  name,
  shownType,
  dateLabel,
  comment,
  qualifiedEfforts,
  aiVerdict,
  dynamicsBaseline,
  shoe = null,
  shoeOptions = NO_SHOES,
  similarRuns = null,
  extras,
  footer,
  back,
  share,
  chartZones = null,
}: Props) {
  const type = shownType ?? activity.type
  // In ?tab=, so going back from Charts or Dynamics lands on it again.
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

  const bestEfforts = activity.bestEfforts && (
    <BestEfforts bestEfforts={activity.bestEfforts} qualifiedEfforts={qualifiedEfforts} />
  )
  const recordsFirst = !!qualifiedEfforts?.some((effort) => activity.bestEfforts?.[effort.key] != null)

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
      <RunMapHero
        route={activity.route ?? null}
        back={back}
        share={share}
        card={
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <TypeDot type={type} />
                <span className="min-w-0 truncate text-[17px] font-bold text-foreground">{name}</span>
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground">{dateLabel}</span>
            </div>
            <StatStrip stats={buildMapStats(activity)} testId="map-card-stats" />
          </div>
        }
      />

      <header className="-mt-1 flex flex-col gap-1">
        <p data-title-sub className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-5 text-muted-foreground" data-testid="activity-subtitle">
          <TypeDot type={type} />
          {name.trim().toLowerCase() !== t.activityTypes[type].toLowerCase() && (
            <>
              {t.activityTypes[type]}
              <span aria-hidden>·</span>
            </>
          )}
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
      {activity.gapSecPerKm != null && activity.elevationGain != null && (() => {
        const [lead, pace, rest] = t.activity.stats.gap(`${formatClock(activity.gapSecPerKm)} ${t.units.perKm}`, `${Math.round(activity.elevationGain)}`)
        return (
          <p className="-mt-2 text-[13px] text-muted-foreground" data-testid="run-gap">
            {lead}
            <b className="font-semibold text-foreground">{pace}</b>
            {rest}
          </p>
        )
      })()}

      <RunVerdict activity={activity} type={type} aiVerdict={aiVerdict}>
        {activity.hrUntrusted ? (
          <span className={cn(RUN_CHIP_CLASS, 'font-semibold text-[var(--warn)]')} data-testid="run-hr-untrusted">
            {t.activity.dataQuality.hrUntrusted[activity.hrUntrusted]}
          </span>
        ) : (
          !activity.avgHeartRate && (
            <span className={cn(RUN_CHIP_CLASS, 'font-semibold text-[var(--warn)]')}>{t.activity.dataQuality.estimated}</span>
          )
        )}
        <span className={RUN_CHIP_CLASS} data-testid="run-effort">
          {activity.rpe !== null ? t.activities.row.rpeValue(activity.rpe) : `${e.label} ${e.notLogged}`}
        </span>
        {activity.weather &&
          conditionsChips(activity.weather).map((text) => (
            <span key={text} className={RUN_CHIP_CLASS} data-testid="run-conditions">
              {text}
            </span>
          ))}
        <RunShoe
          activityId={activity.id}
          shoe={shoe}
          options={shoeOptions}
          garminUrl={isWatchId(activity.id) && !activity.gearPending ? garminActivityUrl(activity.id) : null}
        />
        <ActivityNotes activityId={activity.id} />
      </RunVerdict>

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

      {/* At least a screen tall on a phone, so a short tab still lets the strip
          scroll up to the title bar. */}
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
            {recordsFirst && bestEfforts}
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
            {!recordsFirst && bestEfforts}
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
            gapSamples={activity.gapSamples ?? null}
            cadenceSamples={activity.cadenceSamples}
            avgCadence={activity.cadenceSpm}
            elevationProfile={activity.elevationProfile}
            elevationGain={activity.elevationGain}
            zones={chartZones}
          />
        )}

        {tab === 'dynamics' && <RunningDynamics activity={activity} baseline={dynamicsBaseline} />}

        {footer}
      </div>
    </>
  )
}
