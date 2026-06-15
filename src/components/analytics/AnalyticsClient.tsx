'use client'

import { useEffect, useRef, useState } from 'react'
import { Footprints, Timer, Hash, Mountain, Gauge, Flame } from 'lucide-react'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import type { AnalyticsPageData, PeriodDelta } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { HrTrendChart } from './HrTrendChart'
import { CadenceTrendChart } from './CadenceTrendChart'
import { LongRunsChart } from './LongRunsChart'
import { EasyHardChart } from './EasyHardChart'
import { YearComparisonSection } from './YearComparisonSection'
import { DistanceDistributionChart } from './DistanceDistributionChart'
import { MonthlyComparisonChart } from './MonthlyComparisonChart'
import { RpeTrendChart } from './RpeTrendChart'
import { TrainingEffectChart } from './TrainingEffectChart'
import { DailyEfficiencyChart } from './DailyEfficiencyChart'
import { TrainingZones } from '@/components/goals/TrainingZones'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

const TABS = [
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'physiology',  label: t.analytics.tabs.physiology  },
  { id: 'volume',      label: t.analytics.tabs.volume      },
  { id: 'seasons',     label: t.analytics.tabs.seasons     },
] as const

type TabId = (typeof TABS)[number]['id']

type View = { kind: 'year'; year: number } | { kind: 'period'; weeks: number }

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  className?: string
}

function StatCard({ icon, label, value, className }: StatCardProps) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-card ${className ?? ''}`}>
      <div className="text-subtle">{icon}</div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-xs text-subtle">{label}</span>
    </div>
  )
}

function chipClass(active: boolean): string {
  return [
    'shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
    active ? 'bg-emerald-500 text-white' : 'border border-border bg-card text-muted-foreground hover:bg-muted',
  ].join(' ')
}

function DeltaStrip({ delta, weeks }: { delta: PeriodDelta; weeks: number }) {
  const items: { text: string; good: boolean }[] = []
  if (delta.distancePct != null) items.push({ text: t.analytics.period.distancePct(delta.distancePct), good: delta.distancePct >= 0 })
  if (delta.sessionsPct != null) items.push({ text: t.analytics.period.sessionsPct(delta.sessionsPct), good: delta.sessionsPct >= 0 })
  if (delta.easyPaceSec != null && delta.easyPaceSec !== 0) {
    const faster = delta.easyPaceSec < 0
    items.push({
      text: faster ? t.analytics.period.paceFaster(Math.abs(delta.easyPaceSec)) : t.analytics.period.paceSlower(delta.easyPaceSec),
      good: faster,
    })
  }
  if (!items.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      {items.map((it, i) => (
        <span key={i} className={it.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}>
          {it.text}
        </span>
      ))}
      <span className="text-subtle">{t.analytics.period.vsPrevious(weeks)}</span>
    </div>
  )
}

export function AnalyticsClient({ data, comparison, zones }: { data: AnalyticsPageData; comparison: YearComparisonData | null; zones: TrainingZonesData | null }) {
  const { years, byYear, periodWeeks, byPeriod } = data
  const [view, setView] = useState<View>({ kind: 'year', year: years[0] })
  const [tab, setTab] = useState<TabId>('performance')
  const yearsRef = useRef<HTMLDivElement | null>(null)
  const periodsRef = useRef<HTMLDivElement | null>(null)
  const activeChipRef = useRef<HTMLButtonElement | null>(null)

  const active = view.kind === 'year' ? byYear[view.year] : byPeriod[view.weeks]
  const totals = active.totals
  const isPeriod = view.kind === 'period'

  useEffect(() => {
    const active = activeChipRef.current
    if (!active) return

    // choose the container depending on which kind is active
    const container = view.kind === 'year' ? yearsRef.current : periodsRef.current
    if (!container) return

    try {
      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      const offset = (activeRect.left + activeRect.right) / 2 - (containerRect.left + containerRect.right) / 2
      container.scrollBy({ left: offset, behavior: 'smooth' })
    } catch {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [view, years, periodWeeks])

  function selectPeriod(weeks: number) {
    setView({ kind: 'period', weeks })
    if (tab === 'seasons') setTab('volume') // year-only tab
  }

  const visibleTabs = isPeriod ? TABS.filter((tb) => tb.id !== 'seasons') : TABS

  // Rolling periods are anchored to today, so only offer them on the most recent
  // year (or while a period is active). Past years just show their calendar view.
  const showPeriods = view.kind === 'period' || view.year === years[0]

  const statCards: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    {
      icon: <Footprints size={16} className="text-emerald-500 dark:text-emerald-400" />,
      label: t.analytics.stats.distance,
      value: <><AnimatedValue value={totals.distanceKm} /> {t.units.km}</>,
    },
    {
      icon: <Timer size={16} className="text-blue-500 dark:text-blue-400" />,
      label: t.analytics.stats.time,
      value: formatDuration(totals.durationSeconds),
    },
    {
      icon: <Hash size={16} className="text-violet-500 dark:text-violet-400" />,
      label: t.analytics.stats.sessions,
      value: <AnimatedValue value={totals.sessionCount} />,
    },
    {
      icon: <Mountain size={16} className="text-stone-500 dark:text-stone-400" />,
      label: t.analytics.stats.elevation,
      value: <>+<AnimatedValue value={totals.elevationM} /> m</>,
    },
    {
      icon: <Gauge size={16} className="text-amber-500 dark:text-amber-400" />,
      label: t.analytics.stats.avgPerWeek,
      value: <><AnimatedValue value={totals.avgKmPerWeek} decimals={1} /> {t.units.km}</>,
    },
    ...(totals.calories > 0
      ? [
          {
            icon: <Flame size={16} className="text-orange-500 dark:text-orange-400" />,
            label: t.analytics.stats.calories,
            value: <><AnimatedValue value={totals.calories / 1000} decimals={1} />k kcal</>,
          },
          {
            icon: <Flame size={16} className="text-red-500 dark:text-red-400" />,
            label: t.analytics.stats.kcalPerWeek,
            value: <AnimatedValue value={totals.caloriesPerWeek} />,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.analytics.title}</h1>
            <div ref={yearsRef} className="flex items-center gap-1 overflow-x-auto">
              {years.map((y) => (
                <button
                  ref={view.kind === 'year' && view.year === y ? activeChipRef : undefined}
                  key={y}
                  onClick={() => setView({ kind: 'year', year: y })}
                  className={chipClass(view.kind === 'year' && view.year === y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isPeriod ? t.analytics.period.title(view.weeks) : t.analytics.season(view.year)}
            </p>
            <div ref={periodsRef} className="flex items-center gap-1 overflow-x-auto">
              {showPeriods && (
                <>
                  {periodWeeks.map((w) => (
                    <button
                      ref={view.kind === 'period' && view.weeks === w ? activeChipRef : undefined}
                      key={`p${w}`}
                      onClick={() => selectPeriod(w)}
                      className={chipClass(view.kind === 'period' && view.weeks === w)}
                    >
                      {t.analytics.period.chip(w)}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        {view.kind === 'period' && 'delta' in active && active.delta && <DeltaStrip delta={active.delta} weeks={view.weeks} />}
      </div>

      {/* Stats - odd count, so the last card spans full width on mobile to avoid a lonely orphan */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card, idx) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            className={statCards.length % 2 === 1 && idx === statCards.length - 1 ? 'col-span-2 sm:col-span-1' : ''}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={[
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {item.label}
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
        </div>
      )}

      {/* Tab: Performance */}
      {tab === 'performance' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PaceTrendChart data={active.paceTrend} />
          <EfficiencyChart data={active.efficiencyTrend} />
          <EasyHardChart data={active.easyHardSplit} />
          <RpeTrendChart data={active.rpeTrend} />
        </div>
      )}

      {/* Tab: Physiology */}
      {tab === 'physiology' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HrTrendChart data={active.hrTrend} />
            <ZoneDistributionChart data={active.zoneDistribution} />
            <CadenceTrendChart data={active.cadenceTrend} />
            <TrainingEffectChart data={active.trainingEffectTrend} />
          </div>
          <DailyEfficiencyChart data={data.efficiencyDaily} />
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
    </div>
  )
}
