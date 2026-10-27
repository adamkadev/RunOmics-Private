'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import type { LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import type { RunBests } from '@/domain/activity/paceCurve'
import type { LoadPair } from '@/domain/training/loadTrend'
import type { RecoveryDay } from '@/domain/training/recovery'
import { ChartCardSkeleton } from '@/components/ui/Skeleton'
import { useSwipeNavigation } from '@/lib/useSwipeNavigation'
import { useToday } from '@/lib/useToday'
import { useUrlParam } from '@/lib/useUrlParam'
import { StickyBar } from '@/components/ui/StickyBar'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDateRange } from '@/lib/formatters'
import { t } from '@/i18n'
import { PeriodControl } from './AnalyticsKit'
import { CoachRead } from './CoachRead'
import { tabRead } from './coachReadTabs'
import {
  LOAD_PERIODS,
  PERIODS,
  WEEK_PERIODS,
  dayWindow,
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
  <div className="flex flex-col gap-5">
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
  /** Garmin's acute/chronic pair per day, or the app's own where the watch sends none. */
  loads: LoadPair[]
  /** Which of the two the app worked out itself, the watch rating neither. */
  estimated: { loads: boolean; status: boolean }
  /** Daily resting HR; empty until the recovery sync has run. */
  recovery: RecoveryDay[]
  weeks: WeeklyTrendPoint[]
  plan: PlanWeekInput[]
  /** Days whose planned session was missed, by Plan's own day states. */
  missed: string[]
  vo2max: { value: number | null; samples: { date: string; vo2max: number }[] }
  threshold: { date: string; pace: number }[]
  /** The watch's threshold heart rate, revised with its threshold pace. */
  predictions: PredictionDay[]
  race: GoalRaceInput | null
  heat: HeatImpactData | null
  /** The watch's load focus, absent on a watch without it. */
  balance: LoadBalanceData | null
  /** Each run's duration bests, oldest first; empty until the runs are reprocessed. */
  paceBests: RunBests[]
  ytd: YtdInput | null
  /** The app's one weekly average: the last 12 complete weeks. */
  weeklyAvgKm: number | null
}

const DEFAULT_PERIOD: Record<TabId, LoadPeriod> = { fitness: '4w', performance: '12w', volume: '12w', health: '12w' }

function parseAnalyticsTab(value: string | null): TabId {
  return TABS.find((tb) => tb.id === value)?.id ?? 'fitness'
}

function parseAnalyticsPeriod(value: string | null, tab: TabId): LoadPeriod {
  return PERIODS.find((p) => p === value) ?? DEFAULT_PERIOD[tab]
}

export function AnalyticsClient({ data, today: serverToday }: { data: AnalyticsBoardData; today: string }) {
  const today = useToday(serverToday)
  // Tab and period live in the URL, so Back returns to them and a push can open /analytics?tab=volume.
  const [tabParam, setTabParam] = useUrlParam('tab')
  const [periodParam, setPeriodParam] = useUrlParam('period')
  const tab = parseAnalyticsTab(tabParam)
  const period = parseAnalyticsPeriod(periodParam, tab)
  const [periods, setPeriods] = useState<Partial<Record<TabId, LoadPeriod>>>({})
  const [offsets, setOffsets] = useState<Partial<Record<TabId, number>>>({})
  const offset = offsets[tab] ?? 0
  const tabsRef = useRef<HTMLDivElement>(null)

  function writePeriod(next: TabId, value: LoadPeriod) {
    setPeriodParam(value === DEFAULT_PERIOD[next] ? null : value)
  }

  function selectTab(id: TabId) {
    // Before the new tab paints: a page left even 1-2 pt down sets off iOS's scroll-edge blur over the large title.
    if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' })
    setPeriods((all) => ({ ...all, [tab]: period }))
    setTabParam(id === 'fitness' ? null : id)
    writePeriod(id, periods[id] ?? DEFAULT_PERIOD[id])
  }

  // A tab swap changes the page under the title without a scroll: have the
  // compact bar re-read where it is.
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
  const loadTab = tab === 'fitness' || tab === 'performance'
  const days = loadTab ? dayWindow(today, period, offset) : null
  const weeks = loadTab ? null : weekWindow(today, period as WeekPeriod, offset)

  function shift(step: 1 | -1) {
    const next = offset + step
    if (next < 0) return
    const start = loadTab ? dayWindow(today, period, next).end : weekWindow(today, period as WeekPeriod, next).end
    if (start < earliest) return
    setOffsets((all) => ({ ...all, [tab]: next }))
  }

  function setPeriod(next: LoadPeriod) {
    writePeriod(tab, next)
    setOffsets((all) => ({ ...all, [tab]: 0 }))
  }

  const rows = weeks ? weekRows(data.weeks, data.plan, weeks, today) : []
  const range = days ?? weeks!
  // A year by its months: its days made the line too wide to sit beside the period control on a phone.
  const rangeLabel = formatDateRange(range.start, range.live ? today : range.end, { year: 'always', precision: period === '1y' ? 'month' : 'day' })

  // Each tab's own coach read over its own window, so a tab set to 4 weeks never reads "12 weeks".
  const coach = useMemo(() => {
    const live = loadTab ? dayWindow(today, period, offset) : weekWindow(today, period as WeekPeriod, offset)
    const weekly = loadTab ? [] : weekRows(data.weeks, data.plan, live as ReturnType<typeof weekWindow>, today)
    return tabRead({ tab, data, today, period, days: loadTab ? (live as ReturnType<typeof dayWindow>) : null, rows: weekly, live: live.live })
  }, [data, today, tab, period, offset, loadTab])
  const coachEyebrow = t.analytics.cards.coachRead.eyebrow(t.analytics.cards.period.words[period]!, t.analytics.tabs[tab])

  return (
    <div className="flex flex-col gap-5">
      <header className="mb-1.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 data-testid="analytics-title" className="text-display text-foreground">
            {t.analytics.title}
          </h1>
          {/* The subtitle fades under the compact title bar, which sets its
              opacity from the layout before this page hydrates. */}
          <p className="truncate text-sm text-muted-foreground" data-testid="analytics-range">
            {rangeLabel}
          </p>
        </div>
        <PeriodControl periods={loadTab ? LOAD_PERIODS : WEEK_PERIODS} value={period} onChange={setPeriod} />
      </header>

      {/* Its 8 pt of padding is for when it sticks; at rest the tabs sit the
          page's 14 pt from the header and the coach read. */}
      <StickyBar ref={tabsRef} top="var(--sticky-top, var(--sticky-alone, max(var(--safe-top), 8px)))" className="-my-2">
        <SegmentedTabs tabs={analyticsTabs} items={TABS} label={t.analytics.title} size="md" fill onAura />
      </StickyBar>

      {coach && <CoachRead read={coach} eyebrow={coachEyebrow} />}

      <div {...analyticsTabs.panelProps} {...swipeHandlers}>
        {tab === 'fitness' && days && (
          <LoadTab window={days} period={period} onShift={shift} today={today} data={data} />
        )}
        {tab === 'performance' && days && (
          <PerformanceTab
            window={days}
            period={period}
            onShift={shift}
            today={today}
            weeks={data.weeks}
            vo2max={data.vo2max}
            threshold={data.threshold}
            predictions={data.predictions}
            race={data.race}
            heat={data.heat}
            paceBests={data.paceBests}
          />
        )}
        {tab === 'volume' && weeks && <VolumeTab rows={rows} live={weeks.live} onShift={shift} ytd={data.ytd} weeklyAvgKm={data.weeklyAvgKm} />}
        {tab === 'health' && weeks && <IntensityTab rows={rows} live={weeks.live} onShift={shift} plan={data.plan} />}
      </div>
    </div>
  )
}
