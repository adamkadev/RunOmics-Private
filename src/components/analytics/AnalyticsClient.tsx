'use client'

import { useEffect, useState } from 'react'
import { Footprints, Timer, Hash, Mountain, Gauge, Flame, ChevronUp } from 'lucide-react'
import type { AnalyticsPageData } from '@/application/usecases/GetAnalyticsData'
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
import { YearSelector } from '@/components/ui/YearSelector'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

const TABS = [
  { id: 'volume',      label: t.analytics.tabs.volume      },
  { id: 'performance', label: t.analytics.tabs.performance },
  { id: 'physiology',  label: t.analytics.tabs.physiology  },
  { id: 'seasons',     label: t.analytics.tabs.seasons     },
] as const

type TabId = (typeof TABS)[number]['id']

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
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

export function AnalyticsClient({ data, comparison }: { data: AnalyticsPageData; comparison: YearComparisonData | null }) {
  const { years, byYear } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const [tab, setTab] = useState<TabId>('volume')
  const [showScrollTop, setShowScrollTop] = useState(false)

  const yearData = byYear[selectedYear]
  const totals = yearData.totals

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const prevYear = years.find((y) => y !== selectedYear) ?? years[1]

  const statCards = [
    {
      icon: <Footprints size={16} className="text-emerald-500 dark:text-emerald-400" />,
      label: t.analytics.stats.distance,
      value: `${totals.distanceKm.toFixed(0)} ${t.units.km}`,
    },
    {
      icon: <Timer size={16} className="text-blue-500 dark:text-blue-400" />,
      label: t.analytics.stats.time,
      value: formatDuration(totals.durationSeconds),
    },
    {
      icon: <Hash size={16} className="text-violet-500 dark:text-violet-400" />,
      label: t.analytics.stats.sessions,
      value: String(totals.sessionCount),
    },
    {
      icon: <Mountain size={16} className="text-stone-500 dark:text-stone-400" />,
      label: t.analytics.stats.elevation,
      value: t.analytics.stats.elevationValue(totals.elevationM),
    },
    {
      icon: <Gauge size={16} className="text-amber-500 dark:text-amber-400" />,
      label: t.analytics.stats.avgPerWeek,
      value: `${totals.avgKmPerWeek} ${t.units.km}`,
    },
    ...(totals.calories > 0
      ? [
          {
            icon: <Flame size={16} className="text-orange-500 dark:text-orange-400" />,
            label: t.analytics.stats.calories,
            value: t.analytics.stats.caloriesValue(Number((totals.calories / 1000).toFixed(1))),
          },
          {
            icon: <Flame size={16} className="text-red-500 dark:text-red-400" />,
            label: t.analytics.stats.kcalPerWeek,
            value: String(totals.caloriesPerWeek),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.analytics.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.analytics.season(selectedYear)}</p>
        </div>
        <YearSelector years={years} selected={selectedYear} onSelect={setSelectedYear} />
      </div>

      {/* Stats - odd count, so the last card spans full width on mobile to avoid a lonely orphan */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {statCards.map((card, idx) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            className={idx === statCards.length - 1 ? 'col-span-2 sm:col-span-1' : ''}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((item) => (
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
          <MonthlyVolumeChart data={yearData.monthlyVolume} typesPresent={yearData.typesPresent} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LongRunsChart data={yearData.longRuns} />
            <DistanceDistributionChart data={yearData.distanceDistribution} />
          </div>
        </div>
      )}

      {/* Tab: Performance */}
      {tab === 'performance' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PaceTrendChart data={yearData.paceTrend} />
          <EfficiencyChart data={yearData.efficiencyTrend} />
          <EasyHardChart data={yearData.easyHardSplit} />
          <RpeTrendChart data={yearData.rpeTrend} />
        </div>
      )}

      {/* Tab: Physiologie */}
      {tab === 'physiology' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HrTrendChart data={yearData.hrTrend} />
          <ZoneDistributionChart data={yearData.zoneDistribution} />
          <CadenceTrendChart data={yearData.cadenceTrend} />
          <TrainingEffectChart data={yearData.trainingEffectTrend} />
        </div>
      )}

      {/* Tab: Saisons */}
      {tab === 'seasons' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {prevYear !== undefined && (
            <MonthlyComparisonChart
              currentYear={selectedYear}
              currentData={yearData.monthlyVolume}
              prevYear={prevYear}
              prevData={byYear[prevYear]?.monthlyVolume ?? []}
            />
          )}
          {comparison && <YearComparisonSection data={comparison} />}
        </div>
      )}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all hover:bg-muted active:scale-95"
          aria-label={t.analytics.scrollTop}
        >
          <ChevronUp size={18} className="text-foreground" />
        </button>
      )}
    </div>
  )
}
