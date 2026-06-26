'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
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
import { RunningDynamicsTrendChart } from './RunningDynamicsTrendChart'
import { VO2maxChart } from './VO2maxChart'
import { TemperatureCorrelationChart } from './TemperatureCorrelationChart'
import { RpeLoadCorrelationChart } from './RpeLoadCorrelationChart'
import type { VO2maxPoint } from '@/application/usecases/GetVO2maxHistory'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { TrainingLoadData } from '@/application/usecases/GetTrainingLoad'
import { formatDurationShort } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { TrainingLoadChart } from '@/components/dashboard/TrainingLoadChart'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'

const TABS = [
  { id: 'volume', label: t.analytics.tabs.volume },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'physiology', label: t.analytics.tabs.physiology },
  { id: 'seasons', label: t.analytics.tabs.seasons },
] as const

type TabId = (typeof TABS)[number]['id']
type View = { kind: 'year'; year: number } | { kind: 'period'; weeks: number } | { kind: 'all' }

function DeltaBadge({ text, good }: { text: string; good: boolean }) {
  const Icon = good ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-caption font-medium',
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
  vo2maxHistory,
  lifetime,
  zones,
  trainingLoad,
}: {
  data: AnalyticsPageData
  comparison: YearComparisonData | null
  vo2maxHistory: VO2maxPoint[]
  lifetime: LifetimeStats | null
  zones: TrainingZonesData | null
  trainingLoad: TrainingLoadData | null
}) {
  const { years, byYear, periodWeeks, byPeriod } = data

  const [view, setView] = useState<View>({ kind: 'year', year: years[0] })
  const [tab, setTab] = useState<TabId>('volume')

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
  const displayYear = view.kind === 'year' ? view.year : years[0]

  const metrics: Metric[] =
    isAll && lifetime && totals
      ? [
          {
            value: <AnimatedValue value={totals.distanceKm} />,
            unit: t.units.km,
            label: t.analytics.stats.distance,
          },
          {
            value: formatDurationShort(totals.durationSeconds),
            unit: t.units.hour,
            label: t.analytics.stats.time,
          },
          {
            value: <AnimatedValue value={totals.sessionCount} />,
            label: t.analytics.stats.sessions,
          },
          {
            value: <AnimatedValue value={totals.elevationM} />,
            unit: t.units.elevation,
            label: t.analytics.stats.elevation,
          },
          {
            value: <AnimatedValue value={totals.avgKmPerWeek} decimals={1} />,
            unit: t.units.km,
            label: t.analytics.stats.avgPerWeek,
          },
          {
            value: <AnimatedValue value={lifetime.yearsTracked} decimals={1} />,
            label: t.analytics.stats.yearsTracked,
          },
        ]
      : totals
        ? [
            {
              value: <AnimatedValue value={totals.distanceKm} />,
              unit: t.units.km,
              label: t.analytics.stats.distance,
            },
            {
              value: formatDurationShort(totals.durationSeconds),
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
            ...(totals.calories > 0
              ? [
                  {
                    value: <AnimatedValue value={totals.calories / 1000} decimals={1} />,
                    unit: `${'k'} ${t.units.kcal}`,
                    label: t.analytics.stats.calories,
                  },
                ]
              : []),
          ]
        : []

  const deltaBadges: ReactNode[] =
    view.kind === 'period'
      ? (() => {
          const d = byPeriod[view.weeks].delta
          return d ? buildDeltaBadges(d) : []
        })()
      : []

  return (
    <div className="space-y-4">
      <GlassSurface as="div" variant="nav" className="top-2 z-20 space-y-2.5 rounded-2xl px-5 py-3">
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
        />
      </GlassSurface>

      {/* Stats */}
      {metrics.length > 0 && (
        <GlassSurface variant="card">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-foreground/[0.08] px-5 py-3.5">
            <span className="text-sm font-semibold text-foreground">
              {periodLabel}
            </span>

            {deltaBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{deltaBadges}</div>
            )}
          </div>

          <div className="px-5 py-5">
            <MetricGrid metrics={metrics} className="grid-cols-3 lg:grid-cols-6" />
          </div>
        </GlassSurface>
      )}

      {/* Tabs */}
      {active && (
        <>
          <div className="sticky top-[max(env(safe-area-inset-top),8px)] z-10 flex border-b border-border bg-background/80 backdrop-blur-md">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                className={cn(
                  'relative flex-1 py-3 text-sm font-medium transition-colors',
                  tab === item.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {tab === item.id && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          {/* Content unchanged */}
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
              {data.rpeLoadCorrelation.length >= 10 && (
                <RpeLoadCorrelationChart data={data.rpeLoadCorrelation} />
              )}
            </div>
          )}

          {tab === 'physiology' && (
            <div className="space-y-4">
              {trainingLoad && <TrainingLoadChart data={trainingLoad} />}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {vo2maxHistory.length >= 2 && (
                  <VO2maxChart data={vo2maxHistory} />
                )}
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

              {!isAll && (
                <RunningDynamicsTrendChart data={data.runningDynamicsDaily} />
              )}

              {zones && <TrainingZones data={zones} />}
            </div>
          )}

          {tab === 'seasons' && view.kind === 'year' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(() => {
                const prevYear =
                  years.find((y) => y < view.year) ??
                  years.find((y) => y !== view.year)

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