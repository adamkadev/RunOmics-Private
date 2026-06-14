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
import { YearSelector } from '@/components/ui/YearSelector'
import { formatDuration } from '@/lib/formatters'

const TABS = [
  { id: 'volume',      label: 'Volume'      },
  { id: 'performance', label: 'Performance' },
  { id: 'physiology',  label: 'Physiology'  },
  { id: 'seasons',     label: 'Seasons'     },
] as const

type TabId = (typeof TABS)[number]['id']

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
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
  const t = yearData.totals

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const prevYear = years.find((y) => y !== selectedYear) ?? years[1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{selectedYear} season</p>
        </div>
        <YearSelector years={years} selected={selectedYear} onSelect={setSelectedYear} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard
          icon={<Footprints size={16} className="text-emerald-500 dark:text-emerald-400" />}
          label="Distance"
          value={`${t.distanceKm.toFixed(0)} km`}
        />
        <StatCard
          icon={<Timer size={16} className="text-blue-500 dark:text-blue-400" />}
          label="Time"
          value={formatDuration(t.durationSeconds)}
        />
        <StatCard
          icon={<Hash size={16} className="text-violet-500 dark:text-violet-400" />}
          label="Sessions"
          value={String(t.sessionCount)}
        />
        <StatCard
          icon={<Mountain size={16} className="text-stone-500 dark:text-stone-400" />}
          label="Elevation"
          value={`+${t.elevationM} m`}
        />
        <StatCard
          icon={<Gauge size={16} className="text-amber-500 dark:text-amber-400" />}
          label="Avg / week"
          value={`${t.avgKmPerWeek} km`}
        />
        {t.calories > 0 && (
          <>
            <StatCard
              icon={<Flame size={16} className="text-orange-500 dark:text-orange-400" />}
              label="Calories"
              value={`${(t.calories / 1000).toFixed(1)}k kcal`}
            />
            <StatCard
              icon={<Flame size={16} className="text-red-500 dark:text-red-400" />}
              label="Kcal / week"
              value={String(t.caloriesPerWeek)}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
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
        </div>
      )}

      {/* Tab: Physiologie */}
      {tab === 'physiology' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HrTrendChart data={yearData.hrTrend} />
          <ZoneDistributionChart data={yearData.zoneDistribution} />
          <CadenceTrendChart data={yearData.cadenceTrend} />
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
          aria-label="Scroll to top"
        >
          <ChevronUp size={18} className="text-foreground" />
        </button>
      )}
    </div>
  )
}
