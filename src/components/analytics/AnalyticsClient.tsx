'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import type { AnalyticsPageData, PeriodDelta } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import { SeasonHeadline } from '@/components/analytics/SeasonHeadline'
import type { LifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { YearSelector } from '@/components/ui/YearSelector'
import type { VO2maxPoint } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import { formatDurationShort } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { STATUS } from '@/lib/statusColors'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { t } from '@/i18n'

import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { AnimatedDuration } from '../ui/AnimatedDuration'

// Each tab panel is code-split so the analytics page only parses/hydrates the
// charts of the visible tab (~20 Recharts components across all tabs).
const tabLoading = () => (
  <div className="space-y-4">
    <ChartCardSkeleton />
    <ChartCardSkeleton />
  </div>
)
const VolumeTab = dynamic(() => import('./VolumeTab').then((m) => m.VolumeTab), { loading: tabLoading })
const PerformanceTab = dynamic(() => import('./PerformanceTab').then((m) => m.PerformanceTab), { loading: tabLoading })
const PhysiologyTab = dynamic(() => import('./PhysiologyTab').then((m) => m.PhysiologyTab), { loading: tabLoading })
const SeasonsTab = dynamic(() => import('./SeasonsTab').then((m) => m.SeasonsTab), { loading: tabLoading })

const TABS = [
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'volume', label: t.analytics.tabs.volume },
  { id: 'physiology', label: t.analytics.tabs.physiology },
  { id: 'seasons', label: t.analytics.tabs.seasons },
] as const

type TabId = (typeof TABS)[number]['id']
type View = { kind: 'year'; year: number } | { kind: 'period'; weeks: number } | { kind: 'all' }

const VIEW_STORAGE_KEY = 'analytics:view'

function readStoredView(years: number[], periodWeeks: number[]): View | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<View>
    if (parsed.kind === 'year' && typeof parsed.year === 'number' && years.includes(parsed.year)) {
      return { kind: 'year', year: parsed.year }
    }
    if (parsed.kind === 'period' && typeof parsed.weeks === 'number' && periodWeeks.includes(parsed.weeks)) {
      return { kind: 'period', weeks: parsed.weeks }
    }
    if (parsed.kind === 'all') return { kind: 'all' }
  } catch {
    // Malformed/absent storage - fall back to the default view.
  }
  return null
}

function DeltaBadge({ text, good }: { text: string; good: boolean }) {
  const Icon = good ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        good ? STATUS.success.badge : STATUS.danger.badge,
      )}
    >
      <Icon size={14} strokeWidth={2.5} />
      {text}
    </span>
  )
}

function buildDeltaBadges(delta: PeriodDelta): ReactNode[] {
  const badges: ReactNode[] = []

  if (delta.distancePct != null)
    badges.push(<DeltaBadge key="dist" text={t.analytics.period.distancePct(delta.distancePct)} good={delta.distancePct >= 0} />)

  if (delta.sessionsPct != null)
    badges.push(<DeltaBadge key="sess" text={t.analytics.period.sessionsPct(delta.sessionsPct)} good={delta.sessionsPct >= 0} />)

  if (delta.easyPaceSec != null && delta.easyPaceSec !== 0) {
    const faster = delta.easyPaceSec < 0
    badges.push(
      <DeltaBadge
        key="pace"
        text={
          faster
            ? t.analytics.period.paceFaster(Math.abs(delta.easyPaceSec))
            : t.analytics.period.paceSlower(delta.easyPaceSec)
        }
        good={faster}
      />,
    )
  }

  return badges
}

export function AnalyticsClient({
  data,
  comparison,
  seasonHeadline,
  vo2maxHistory,
  lifetime,
  zones,
  trainingLoad,
  loadRisk,
}: {
  data: AnalyticsPageData
  comparison: YearComparisonData | null
  seasonHeadline: SeasonHeadlineData | null
  vo2maxHistory: VO2maxPoint[]
  lifetime: LifetimeStats | null
  zones: TrainingZonesData | null
  trainingLoad: TrainingLoadData | null
  loadRisk: LoadRiskPanelData | null
}) {
  const { years, byYear, periodWeeks, byPeriod } = data

  const [view, setView] = useState<View>({ kind: 'year', year: years[0] ?? new Date().getFullYear() })
  const [tab, setTab] = useState<TabId>('performance')

  // Restore after mount, not in the initializer, to avoid a hydration mismatch.
  useEffect(() => {
    const stored = readStoredView(years, periodWeeks)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    if (stored) setView(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view))
  }, [view])

  function selectTab(id: TabId) {
    setTab(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isPeriod = view.kind === 'period'
  const isAll = view.kind === 'all'

  const active =
    view.kind === 'year'
      ? byYear[view.year]
      : view.kind === 'period'
        ? byPeriod[view.weeks]
        : data.allTime

  const totals = active?.totals ?? null

  const periodLabel = isAll
    ? t.analytics.allTimeTitle
    : isPeriod
      ? t.analytics.period.title(view.weeks)
      : t.analytics.season(view.year)

  function selectPeriod(weeks: number) {
    setView({ kind: 'period', weeks })
    if (tab === 'seasons') setTab('volume')
  }

  function selectAllTime() {
    setView({ kind: 'all' })
    if (tab === 'seasons') setTab('volume')
  }

  function selectYear(y: number) {
    setView({ kind: 'year', year: y })
  }

  const visibleTabs = isPeriod || isAll ? TABS.filter((tb) => tb.id !== 'seasons') : TABS
  const displayYear = view.kind === 'year' ? view.year : (years[0] ?? null)

  function goPrevTab() {
    const idx = visibleTabs.findIndex((tb) => tb.id === tab)
    const prev = idx > 0 ? visibleTabs[idx - 1] : undefined
    if (prev) selectTab(prev.id)
  }

  function goNextTab() {
    const idx = visibleTabs.findIndex((tb) => tb.id === tab)
    const next = idx >= 0 && idx < visibleTabs.length - 1 ? visibleTabs[idx + 1] : undefined
    if (next) selectTab(next.id)
  }

  const { onTouchStart, onTouchEnd } = useSwipeNavigation(goPrevTab, goNextTab)

  const metrics: Metric[] = totals
    ? [
        {
          value: <AnimatedValue value={totals.distanceKm} />,
          unit: t.units.km,
          label: t.analytics.stats.distance,
        },
        {
          value: totals.durationSeconds
            ? <AnimatedDuration seconds={totals.durationSeconds} format={formatDurationShort} />
            : formatDurationShort(0),
          unit: t.units.hour,
          label: t.analytics.stats.time,
        },
        {
          value: <AnimatedValue value={totals.sessionCount} />,
          label: t.analytics.stats.sessions,
        },
        {
          value: <AnimatedValue value={totals.elevationM} />,
          unit: t.units.m,
          label: t.analytics.stats.elevation,
        },
        {
          value: <AnimatedValue value={totals.avgKmPerWeek} decimals={1} />,
          unit: t.units.km,
          label: t.analytics.stats.avgPerWeek,
        },
        ...(isAll && lifetime
          ? [
              {
                value: <AnimatedValue value={lifetime.yearsTracked} decimals={1} />,
                label: t.analytics.stats.yearsTracked,
              },
            ]
          : totals.calories > 0
            ? [
                {
                  value: <AnimatedValue value={totals.calories / 1000} decimals={1} />,
                  unit: `k ${t.units.kcal}`,
                  label: t.analytics.stats.calories,
                },
              ]
            : []),
      ]
    : []

  const periodDelta = view.kind === 'period' ? byPeriod[view.weeks]?.delta : null
  const deltaBadges: ReactNode[] = periodDelta ? buildDeltaBadges(periodDelta) : []

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 px-1">
        <h1 className="text-title1 font-extrabold leading-[1.1] tracking-tight text-foreground">
          {t.analytics.title}
        </h1>

        <YearSelector
          years={years}
          selected={isAll ? null : displayYear}
          onSelect={(y) => (y === null ? selectAllTime() : selectYear(y))}
          allTimeLabel={t.analytics.allTimeChip}
          periods={periodWeeks.map((w) => ({
            weeks: w,
            label: t.analytics.period.chip(w),
          }))}
          activePeriod={isPeriod ? view.weeks : null}
          onSelectPeriod={selectPeriod}
          yearGroupLabel={t.analytics.yearGroupLabel}
          windowGroupLabel={t.analytics.windowGroupLabel}
        />
      </div>

      {seasonHeadline && <SeasonHeadline data={seasonHeadline} />}

      {metrics.length > 0 && (
        <GlassSurface variant="card">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-foreground/[0.08] px-5 py-3.5">
            <span className="text-sm font-semibold text-foreground">{periodLabel}</span>

            <div className="flex flex-wrap items-center gap-1.5">
              {deltaBadges.length > 0 && deltaBadges}
            </div>
          </div>

          <div className="px-5 py-5">
            <MetricGrid metrics={metrics} className={metrics.length <= 5 ? 'grid-cols-5' : 'grid-cols-3 lg:grid-cols-6'} />
          </div>
        </GlassSurface>
      )}

      {active && (
        <>
          <GlassSurface
            as="div"
            variant="card"
            role="tablist"
            aria-label={t.analytics.title}
            className="sticky top-[max(var(--safe-top),8px)] z-10 flex gap-1 overflow-x-auto rounded-xl p-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => selectTab(item.id)}
                className={cn(
                  'min-w-fit flex-1 whitespace-nowrap rounded-lg py-2.5 text-sm font-semibold transition-colors',
                  tab === item.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-subtle hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </GlassSurface>

          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {tab === 'volume' && <VolumeTab series={active} />}

            {tab === 'performance' && (
              <PerformanceTab
                series={active}
                temperatureScatter={data.temperatureScatter}
                rpeLoadCorrelation={data.rpeLoadCorrelation}
              />
            )}

            {tab === 'physiology' && (
              <PhysiologyTab
                series={active}
                trainingLoad={trainingLoad}
                loadRisk={loadRisk}
                vo2maxHistory={vo2maxHistory}
                zones={zones}
                efficiencyDaily={data.efficiencyDaily}
                runningDynamicsDaily={data.runningDynamicsDaily}
                isAll={isAll}
              />
            )}

            {tab === 'seasons' && view.kind === 'year' && (
              <SeasonsTab
                year={view.year}
                years={years}
                byYear={byYear}
                series={active}
                comparison={comparison}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}