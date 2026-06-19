'use client'

import { useState } from 'react'
import { type LucideIcon, Footprints, Timer, Hash, Mountain, Gauge, Flame, CalendarRange, TrendingUp, TrendingDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import type { AnalyticsPageData, PeriodDelta } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import type { LifetimeStats } from '@/application/usecases/GetLifetimeStats'
import { YearSelector } from '@/components/ui/YearSelector'
import { TrainingZones } from './TrainingZones'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { HrTrendChart } from './HrTrendChart'
import { CadenceTrendChart } from './CadenceTrendChart'
import { RunningFormChart } from './RunningFormChart'
import { LongRunsChart } from './LongRunsChart'
import { EasyHardChart } from './EasyHardChart'
import { YearComparisonSection } from './YearComparisonSection'
import { DistanceDistributionChart } from './DistanceDistributionChart'
import { MonthlyComparisonChart } from './MonthlyComparisonChart'
import { RpeTrendChart } from './RpeTrendChart'
import { TrainingEffectChart } from './TrainingEffectChart'
import { DailyEfficiencyChart } from './DailyEfficiencyChart'
import { VO2maxChart } from './VO2maxChart'
import { TemperatureCorrelationChart } from './TemperatureCorrelationChart'
import type { VO2maxPoint } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatDuration } from '@/lib/formatters'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'

const TABS = [
  { id: 'volume',      label: t.analytics.tabs.volume      },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'physiology',  label: t.analytics.tabs.physiology  },
  { id: 'seasons',     label: t.analytics.tabs.seasons     },
] as const

type TabId = (typeof TABS)[number]['id']
type View = { kind: 'year'; year: number } | { kind: 'period'; weeks: number } | { kind: 'all' }

interface StatCell {
  Icon: LucideIcon
  color: string
  value: ReactNode
  label: string
}


function DeltaBadge({ text, good }: { text: string; good: boolean }) {
  const Icon = good ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
      good
        ? 'bg-accent/15 text-accent-text'
        : 'bg-orange-500/15 text-orange-500 dark:text-orange-400',
    )}>
      <Icon size={10} strokeWidth={2.5} />
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
        text={faster ? t.analytics.period.paceFaster(Math.abs(delta.easyPaceSec)) : t.analytics.period.paceSlower(delta.easyPaceSec)}
        good={faster}
      />,
    )
  }
  return badges
}

export function AnalyticsClient({
  data,
  comparison,
  vo2maxHistory,
  lifetime,
  zones,
}: {
  data: AnalyticsPageData
  comparison: YearComparisonData | null
  vo2maxHistory: VO2maxPoint[]
  lifetime: LifetimeStats | null
  zones: TrainingZonesData | null
}) {
  const { years, byYear, periodWeeks, byPeriod } = data
  const [view, setView] = useState<View>({ kind: 'year', year: years[0] })
  const [tab, setTab] = useState<TabId>('volume')

  const isPeriod = view.kind === 'period'
  const isAll = view.kind === 'all'
  const active = view.kind === 'year' ? byYear[view.year] : view.kind === 'period' ? byPeriod[view.weeks] : data.allTime
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
  const displayYear = view.kind === 'year' ? view.year : years[0]

  const statCells: StatCell[] = isAll && lifetime && totals
    ? [
        {
          Icon: Footprints,
          color: 'text-accent-text',
          value: <><AnimatedValue value={totals.distanceKm} /> {t.units.km}</>,
          label: t.analytics.stats.distance,
        },
        {
          Icon: Timer,
          color: 'text-blue-500 dark:text-blue-400',
          value: formatDuration(totals.durationSeconds),
          label: t.analytics.stats.time,
        },
        {
          Icon: Hash,
          color: 'text-violet-500 dark:text-violet-400',
          value: <AnimatedValue value={totals.sessionCount} />,
          label: t.analytics.stats.sessions,
        },
        {
          Icon: Mountain,
          color: 'text-stone-500 dark:text-stone-400',
          value: <>+<AnimatedValue value={totals.elevationM} /> m</>,
          label: t.analytics.stats.elevation,
        },
        {
          Icon: Gauge,
          color: 'text-amber-500 dark:text-amber-400',
          value: <><AnimatedValue value={totals.avgKmPerWeek} decimals={1} /> {t.units.km}</>,
          label: t.analytics.stats.avgPerWeek,
        },
        {
          Icon: CalendarRange,
          color: 'text-indigo-500 dark:text-indigo-400',
          value: <AnimatedValue value={lifetime.yearsTracked} decimals={1} />,
          label: t.analytics.stats.yearsTracked,
        },
      ]
    : totals
    ? [
        {
          Icon: Footprints,
          color: 'text-accent-text',
          value: <><AnimatedValue value={totals.distanceKm} /> {t.units.km}</>,
          label: t.analytics.stats.distance,
        },
        {
          Icon: Timer,
          color: 'text-blue-500 dark:text-blue-400',
          value: formatDuration(totals.durationSeconds),
          label: t.analytics.stats.time,
        },
        {
          Icon: Hash,
          color: 'text-violet-500 dark:text-violet-400',
          value: <AnimatedValue value={totals.sessionCount} />,
          label: t.analytics.stats.sessions,
        },
        {
          Icon: Mountain,
          color: 'text-stone-500 dark:text-stone-400',
          value: <>+<AnimatedValue value={totals.elevationM} /> m</>,
          label: t.analytics.stats.elevation,
        },
        {
          Icon: Gauge,
          color: 'text-amber-500 dark:text-amber-400',
          value: <><AnimatedValue value={totals.avgKmPerWeek} decimals={1} /> {t.units.km}</>,
          label: t.analytics.stats.avgPerWeek,
        },
        ...(totals.calories > 0
          ? [{
              Icon: Flame,
              color: 'text-orange-500 dark:text-orange-400',
              value: <><AnimatedValue value={totals.calories / 1000} decimals={1} />k kcal</>,
              label: t.analytics.stats.calories,
            }]
          : []),
      ]
    : []

  // Pad to next multiple of 3 so gap-px bg-border grid never shows orphaned rows
  const mobileFill = statCells.length % 3 !== 0 ? 3 - (statCells.length % 3) : 0
  const lgColsClass = statCells.length >= 6 ? 'lg:grid-cols-6' : statCells.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-3'

  const deltaBadges: ReactNode[] = view.kind === 'period'
    ? (() => { const d = byPeriod[view.weeks].delta; return d ? buildDeltaBadges(d) : [] })()
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.analytics.title}</h1>

        <YearSelector
            years={years}
            selected={isAll ? null : displayYear}
            onSelect={(y) => y === null ? selectAllTime() : selectYear(y)}
            allTimeLabel={t.analytics.allTimeChip}
            periods={periodWeeks.map((w) => ({ weeks: w, label: t.analytics.period.chip(w) }))}
            activePeriod={isPeriod ? view.weeks : null}
            onSelectPeriod={selectPeriod}
          />
      </div>

      {/* Stats card */}
      {statCells.length > 0 && (
        <div className={cardClass({ overflow: true, padding: 'none' })}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{periodLabel}</span>
            {deltaBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{deltaBadges}</div>
            )}
          </div>
          <div className={cn('grid gap-px bg-border grid-cols-3', lgColsClass)}>
            {statCells.map(({ Icon, color, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 bg-card px-3 py-3 text-center">
                <Icon size={14} className={color} />
                <div className="whitespace-nowrap text-sm font-bold leading-tight text-foreground">{value}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
              </div>
            ))}
            {Array.from({ length: mobileFill }).map((_, i) => (
              <div key={`fill-${i}`} className="bg-card lg:hidden" />
            ))}
          </div>
        </div>
      )}

      {active && (
        <>
          {/* Tabs - underline indicator */}
          <div className="flex border-b border-border">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'relative flex-1 py-2.5 text-sm font-medium transition-colors',
                  tab === item.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {tab === item.id && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Tab: Volume */}
          {tab === 'volume' && (
            <div className="space-y-4">
              <MonthlyVolumeChart data={active.monthlyVolume} typesPresent={active.typesPresent} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <LongRunsChart data={active.longRuns} />
                <DistanceDistributionChart data={active.distanceDistribution} />
              </div>
              <EasyHardChart data={active.easyHardSplit} />
            </div>
          )}

          {/* Tab: Performance */}
          {tab === 'performance' && (
            <div className="space-y-4">
              <PaceTrendChart data={active.paceTrend} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <EfficiencyChart data={active.efficiencyTrend} />
                <RpeTrendChart data={active.rpeTrend} />
              </div>
              {data.temperatureScatter.length >= 10 && (
                <TemperatureCorrelationChart data={data.temperatureScatter} />
              )}
            </div>
          )}

          {/* Tab: Physiology */}
          {tab === 'physiology' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {vo2maxHistory.length >= 2 && <VO2maxChart data={vo2maxHistory} />}
                <HrTrendChart data={active.hrTrend} />
                <ZoneDistributionChart data={active.zoneDistribution} />
                <CadenceTrendChart data={active.cadenceTrend} />
                <div className="lg:col-span-2">
                  <RunningFormChart data={active.runningFormTrend} />
                </div>
              </div>
              <div className={cn('grid grid-cols-1 gap-4', !isAll && 'lg:grid-cols-2')}>
                <TrainingEffectChart data={active.trainingEffectTrend} />
                {!isAll && <DailyEfficiencyChart data={data.efficiencyDaily} />}
              </div>
              {zones && <TrainingZones data={zones} />}
            </div>
          )}

          {/* Tab: Seasons (year view only) */}
          {tab === 'seasons' && view.kind === 'year' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(() => {
                const prevYear = years.find((y) => y < view.year) ?? years.find((y) => y !== view.year)
                return prevYear !== undefined ? (
                  <MonthlyComparisonChart
                    currentYear={view.year}
                    currentData={active.monthlyVolume}
                    prevYear={prevYear}
                    prevData={byYear[prevYear]?.monthlyVolume ?? []}
                  />
                ) : null
              })()}
              {comparison && <YearComparisonSection data={comparison} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
