'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { useToday } from '@/lib/useToday'
import { StickyBar } from '@/components/ui/StickyBar'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDateRange, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { PeriodControl } from './AnalyticsKit'
import {
  LOAD_PERIODS,
  WEEK_PERIODS,
  dayWindow,
  easyHardView,
  weekRows,
  weekWindow,
  type GoalRaceInput,
  type LoadDay,
  type LoadPeriod,
  type PlanWeekInput,
  type PredictionDay,
  type StatusDay,
  type WeekPeriod,
  type YtdInput,
} from './analyticsView'

const tabLoading = () => (
  <div className="space-y-3">
    <ChartCardSkeleton />
    <ChartCardSkeleton />
  </div>
)
const LoadTab = dynamic(() => import('./LoadTab').then((m) => m.LoadTab), { loading: tabLoading })
const PerformanceTab = dynamic(() => import('./PerformanceTab').then((m) => m.PerformanceTab), { loading: tabLoading })
const VolumeTab = dynamic(() => import('./VolumeTab').then((m) => m.VolumeTab), { loading: tabLoading })
const IntensityTab = dynamic(() => import('./IntensityTab').then((m) => m.IntensityTab), { loading: tabLoading })

const TABS = [
  { id: 'fitness', label: t.analytics.tabs.fitness },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'volume', label: t.analytics.tabs.volume },
  { id: 'health', label: t.analytics.tabs.health },
] as const

type TabId = (typeof TABS)[number]['id']

/** Everything the four tabs draw from, raw: each tab windows it itself. */
export interface AnalyticsBoardData {
  load: LoadDay[]
  status: StatusDay[]
  risk: LoadRiskPanel | null
  weeks: WeeklyTrendPoint[]
  plan: PlanWeekInput[]
  vo2max: { value: number | null; samples: { date: string; vo2max: number }[] }
  threshold: { date: string; pace: number }[]
  predictions: PredictionDay[]
  race: GoalRaceInput | null
  heat: HeatImpactData | null
  ytd: YtdInput | null
  /** The app's one weekly average: the last 12 complete weeks. */
  weeklyAvgKm: number | null
}

interface TabWindow<P> {
  period: P
  offset: number
}

const DEFAULTS = {
  fitness: { period: '4w', offset: 0 } as TabWindow<LoadPeriod>,
  performance: { period: '12w', offset: 0 } as TabWindow<LoadPeriod>,
  volume: { period: '12w', offset: 0 } as TabWindow<WeekPeriod>,
  health: { period: '12w', offset: 0 } as TabWindow<WeekPeriod>,
}

export function AnalyticsClient({ data, today: serverToday }: { data: AnalyticsBoardData; today: string }) {
  const today = useToday(serverToday)
  const [tab, setTab] = useState<TabId>('fitness')
  const [windows, setWindows] = useState(DEFAULTS)
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

  // A tab swap changes the page under the title without a scroll: have the
  // compact bar and the large title re-read where they are (v4.6).
  useEffect(() => {
    window.dispatchEvent(new Event('scroll'))
  }, [tab])

  const analyticsTabs = useSegmentedTabs({ ids: TABS.map((item) => item.id), value: tab, onChange: selectTab })

  function goPrevTab() {
    const idx = TABS.findIndex((tb) => tb.id === tab)
    if (idx > 0) selectTab(TABS[idx - 1]!.id)
  }
  function goNextTab() {
    const idx = TABS.findIndex((tb) => tb.id === tab)
    if (idx >= 0 && idx < TABS.length - 1) selectTab(TABS[idx + 1]!.id)
  }
  const swipeHandlers = useSwipeNavigation(goPrevTab, goNextTab)

  // The oldest date any chart has, so a swipe can't go back past the data.
  const earliest = [data.load[0]?.date, data.weeks[0]?.date].filter((d): d is string => !!d).sort()[0] ?? today
  const current = windows[tab]
  const loadTab = tab === 'fitness' || tab === 'performance'
  const days = loadTab ? dayWindow(today, current.period as LoadPeriod, current.offset) : null
  const weeks = loadTab ? null : weekWindow(today, current.period as WeekPeriod, current.offset)

  function shift(step: 1 | -1) {
    setWindows((all) => {
      const w = all[tab]
      const next = w.offset + step
      if (next < 0) return all
      const start = loadTab ? dayWindow(today, w.period as LoadPeriod, next).end : weekWindow(today, w.period as WeekPeriod, next).end
      if (start < earliest) return all
      return { ...all, [tab]: { ...w, offset: next } }
    })
  }

  function setPeriod(period: string) {
    setWindows((all) => ({ ...all, [tab]: { period, offset: 0 } }))
  }

  const rows = weeks ? weekRows(data.weeks, data.plan, weeks, today) : []
  const s = t.analytics.cards.period
  const rangeLabel = days
    ? formatDateRange(days.start, days.end)
    : tab === 'volume'
      ? `${s.weeks(rows.length)} · ${formatDateRange(weeks!.start, weeks!.end)}`
      : `${s.weeks(rows.length)} · ${s.hours(formatKm((easyHardView(rows)?.totalSec ?? 0) / 3600))}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="shrink-0 font-display text-title1 font-bold leading-[1.1] tracking-tight text-foreground">{t.analytics.title}</h1>
      </div>

      <StickyBar ref={tabsRef} top="var(--sticky-top, max(var(--safe-top), 8px))">
        <SegmentedTabs tabs={analyticsTabs} items={TABS} label={t.analytics.title} size="md" fill tabClassName="text-footnote sm:text-[15px]" />
      </StickyBar>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="min-w-0 truncate text-[13px] text-muted-foreground" data-testid="analytics-range">
          {rangeLabel}
        </span>
        <PeriodControl periods={loadTab ? LOAD_PERIODS : WEEK_PERIODS} value={current.period} onChange={setPeriod} />
      </div>

      <div {...analyticsTabs.panelProps} {...swipeHandlers}>
        {tab === 'fitness' && days && (
          <LoadTab window={days} onShift={shift} today={today} data={data} />
        )}
        {tab === 'performance' && days && (
          <PerformanceTab
            window={days}
            period={current.period as LoadPeriod}
            onShift={shift}
            today={today}
            weeks={data.weeks}
            vo2max={data.vo2max}
            threshold={data.threshold}
            predictions={data.predictions}
            race={data.race}
            heat={data.heat}
          />
        )}
        {tab === 'volume' && weeks && <VolumeTab rows={rows} live={weeks.live} onShift={shift} ytd={data.ytd} today={today} weeklyAvgKm={data.weeklyAvgKm} />}
        {tab === 'health' && weeks && <IntensityTab rows={rows} live={weeks.live} onShift={shift} plan={data.plan} />}
      </div>
    </div>
  )
}
