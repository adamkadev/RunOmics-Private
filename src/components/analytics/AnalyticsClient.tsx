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

const TABS = [
  { id: 'fitness', label: t.analytics.tabs.fitness },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'volume', label: t.analytics.tabs.volume },
  { id: 'health', label: t.analytics.tabs.health },
] as const

type TabId = (typeof TABS)[number]['id']

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

      {active && (
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={t.analytics.title}
          className="sticky top-[max(var(--safe-top),8px)] z-20 -mx-4 grid grid-cols-4 gap-1.5 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6"
        >
          {visibleTabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => selectTab(item.id)}
              className={cn(
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
