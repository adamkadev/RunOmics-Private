'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { AnalyticsPageData } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import type { SeasonHeadlineData } from '@/application/usecases/GetSeasonHeadline'
import type { Insight } from '@/lib/gemini'
import { SeasonHeadline } from '@/components/analytics/SeasonHeadline'
import { TabInsight } from '@/components/analytics/TabInsight'
import type { AnalyticsTabInsights } from '@/application/usecases/GetAnalyticsTabInsights'
import { YearSelector } from '@/components/ui/YearSelector'
import type { VO2maxSeries } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import type { LoadRiskPanel as LoadRiskPanelData } from '@/application/usecases/GetLoadRiskPanel'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import type { TrainingStatusHistory } from '@/application/usecases/GetTrainingStatusHistory'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { ThresholdHistoryData } from '@/application/usecases/GetThresholdHistory'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { t } from '@/i18n'

// Each tab panel is code-split so the analytics page only parses/hydrates the
// charts of the visible tab (~20 Recharts components across all tabs).
const tabLoading = () => (
  <div className="space-y-4">
    <ChartCardSkeleton />
    <ChartCardSkeleton />
  </div>
)
const FitnessGroup = dynamic(() => import('./FitnessGroup').then((m) => m.FitnessGroup), { loading: tabLoading })
const PerformanceGroup = dynamic(() => import('./PerformanceGroup').then((m) => m.PerformanceGroup), { loading: tabLoading })
const VolumeGroup = dynamic(() => import('./VolumeGroup').then((m) => m.VolumeGroup), { loading: tabLoading })
const HealthGroup = dynamic(() => import('./HealthGroup').then((m) => m.HealthGroup), { loading: tabLoading })

// The four data-type tabs (Performance/Volume/Physiology/Seasons) become four
// meaning groups: what question is this chart set answering?
const TABS = [
  { id: 'fitness', label: t.analytics.tabs.fitness },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'volume', label: t.analytics.tabs.volume },
  { id: 'health', label: t.analytics.tabs.health },
] as const

type TabId = (typeof TABS)[number]['id']

// Season scope for the headline stats and the Volume group's comparison charts.
// The per-metric trend charts are not governed by this - each one pages through
// its own 4w/6m/1y window (see WindowedChartCard).
type View = { kind: 'year'; year: number } | { kind: 'all' }

const VIEW_STORAGE_KEY = 'analytics:view'

function readStoredView(years: number[]): View | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<View>
    if (parsed.kind === 'year' && typeof parsed.year === 'number' && years.includes(parsed.year)) {
      return { kind: 'year', year: parsed.year }
    }
    if (parsed.kind === 'all') return { kind: 'all' }
  } catch {
    // Malformed/absent storage - fall back to the default view.
  }
  return null
}

export function AnalyticsClient({
  data,
  comparison,
  seasonHeadline,
  seasonInsight,
  tabInsights,
  vo2maxHistory,
  trainingLoad,
  loadRisk,
  loadBalance,
  statusHistory,
  racePredictions,
  threshold,
  vo2maxTopPercent,
  activeDays,
  heatImpact,
}: {
  data: AnalyticsPageData
  comparison: YearComparisonData | null
  seasonHeadline: SeasonHeadlineData | null
  seasonInsight: Insight | null
  tabInsights: AnalyticsTabInsights
  vo2maxHistory: VO2maxSeries
  trainingLoad: TrainingLoadData | null
  loadRisk: LoadRiskPanelData | null
  loadBalance: LoadBalanceData | null
  statusHistory: TrainingStatusHistory | null
  racePredictions: GarminRacePredictionsData | null
  threshold: ThresholdHistoryData | null
  vo2maxTopPercent: number | null
  activeDays: number
  heatImpact: HeatImpactData | null
}) {
  const { years, byYear } = data

  const [view, setView] = useState<View>({ kind: 'year', year: years[0] ?? new Date().getFullYear() })
  const [tab, setTab] = useState<TabId>('fitness')

  // Restore after mount, not in the initializer, to avoid a hydration mismatch.
  useEffect(() => {
    const stored = readStoredView(years)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    if (stored) setView(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view))
  }, [view])

  const tabsRef = useRef<HTMLDivElement>(null)

  function selectTab(id: TabId) {
    setTab(id)
    // When switching tabs from deep in a long panel, bring the tab strip back
    // up so the new panel starts from its top. Two rules keep this from ever
    // nudging the page *downward* - the bug that made the view creep lower on
    // each switch:
    //  1. offsetTop (summed up the offsetParent chain) is the strip's stable
    //     in-flow position; getBoundingClientRect().top reports the *pinned*
    //     safe-area offset once the sticky strip is stuck, so `rect.top +
    //     scrollY` overshot and drifted a little further down every time.
    //  2. We only scroll when we're currently *below* that target, so switching
    //     tabs while already at the top never yanks the header out of view.
    const el = tabsRef.current
    if (el) {
      let docTop = 0
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) docTop += n.offsetTop
      const target = Math.max(docTop - 12, 0)
      if (window.scrollY > target) window.scrollTo({ top: target, behavior: 'smooth' })
    }
  }

  const isAll = view.kind === 'all'

  const active = view.kind === 'year' ? byYear[view.year] : data.allTime

  function selectAllTime() {
    setView({ kind: 'all' })
  }

  function selectYear(y: number) {
    setView({ kind: 'year', year: y })
  }

  // All four meaning groups are available in every view; the year selector only
  // scopes the Volume group's season-over-season comparison.
  const visibleTabs = TABS
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

  const swipeHandlers = useSwipeNavigation(goPrevTab, goNextTab)

  return (
    <div className="space-y-4">
      {/* Title left, season scope right on one line. The year selector only
          scopes the Volume group's season-over-season comparison (the per-metric
          trend charts page through their own windows, and the headline is
          all-time), so it's shown only on that tab - everywhere else it would be
          an inert control. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="shrink-0 font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">
          {t.analytics.title}
        </h1>

        {tab === 'volume' && (
          <YearSelector
            years={years}
            selected={isAll ? null : displayYear}
            onSelect={(y) => (y === null ? selectAllTime() : selectYear(y))}
            allTimeLabel={t.analytics.allTimeChip}
            className="min-w-0 justify-end"
          />
        )}
      </div>

      {/* Group nav sits right under the header, above the season headline -
          it's the primary navigation for this screen, not a secondary control
          buried below the stats. Four equal columns rather than a scroller, so
          "Health" is never half-cropped at the right edge. */}
      {active && (
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={t.analytics.title}
          // No fill and no bottom border - the bg-background/80 slab read as an
          // opaque white band over the accent canvas. Just a backdrop blur so the
          // charts scrolling under the pinned tabs stay legible; the canvas tint
          // shows through untinted.
          className="sticky top-[max(var(--safe-top),8px)] z-20 -mx-4 grid grid-cols-4 gap-1.5 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6"
        >
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => selectTab(item.id)}
              className={cn(
                // px-1: the four tabs share one non-scrolling row, so the label
                // gets the width instead of the chip's padding (320px screens).
                'truncate rounded-full px-1 py-2 text-center text-footnote transition-all active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === item.id
                  ? 'border border-transparent bg-accent font-semibold text-accent-foreground shadow-sm'
                  : 'border border-foreground/[0.12] bg-foreground/[0.06] font-medium text-foreground/60 hover:bg-foreground/[0.10] hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* The season totals card used to sit here. Distance/time/sessions/
          elevation/avg-per-week/calories are the "how far have I come" read,
          so they live on Progress' This year card - Analytics answers "why am
          I improving?" and opens straight on the headline + charts. */}
      {seasonHeadline && <SeasonHeadline data={seasonHeadline} aiTake={seasonInsight} />}

      {active && (
        <>
          <div {...swipeHandlers}>
            {tabInsights[tab] && <TabInsight insight={tabInsights[tab]!} />}

            {tab === 'fitness' && (
              <FitnessGroup
                trainingLoad={trainingLoad}
                statusHistory={statusHistory}
                loadRisk={loadRisk}
                vo2maxHistory={vo2maxHistory}
                vo2maxTopPercent={vo2maxTopPercent}
                weeklyTrends={data.weeklyTrends}
                threshold={threshold}
                activeDays={activeDays}
                racePredictions={racePredictions}
              />
            )}

            {tab === 'performance' && (
              <PerformanceGroup
                weeklyTrends={data.weeklyTrends}
                racePredictions={racePredictions}
                heatImpact={heatImpact}
              />
            )}

            {tab === 'volume' && (
              <VolumeGroup
                series={active}
                weeklyTrends={data.weeklyTrends}
                year={view.kind === 'year' ? view.year : null}
                years={years}
                byYear={byYear}
                comparison={comparison}
              />
            )}

            {tab === 'health' && (
              <HealthGroup
                weeklyTrends={data.weeklyTrends}
                loadBalance={loadBalance}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}