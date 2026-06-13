'use client'

import { useState } from 'react'
import { Footprints, Timer, Hash, Mountain, Gauge, Flame } from 'lucide-react'
import type { AnalyticsPageData } from '@/application/usecases/GetAnalyticsData'
import { MonthlyVolumeChart } from './MonthlyVolumeChart'
import { PaceTrendChart } from './PaceTrendChart'
import { EfficiencyChart } from './EfficiencyChart'
import { ZoneDistributionChart } from './ZoneDistributionChart'
import { HrTrendChart } from './HrTrendChart'
import { CadenceTrendChart } from './CadenceTrendChart'
import { LongRunsChart } from './LongRunsChart'
import { EasyHardChart } from './EasyHardChart'
import { YearSelector } from '@/components/ui/YearSelector'
import { formatDuration } from '@/lib/formatters'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  )
}

export function AnalyticsClient({ data }: { data: AnalyticsPageData }) {
  const { years, byYear } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const yearData = byYear[selectedYear]
  const t = yearData.totals

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {selectedYear} season
          </p>
        </div>
        <YearSelector years={years} selected={selectedYear} onSelect={setSelectedYear} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard
          icon={<Footprints size={16} className="text-emerald-500" />}
          label="Distance"
          value={`${t.distanceKm.toFixed(0)} km`}
        />
        <StatCard
          icon={<Timer size={16} className="text-blue-500" />}
          label="Time"
          value={formatDuration(t.durationSeconds)}
        />
        <StatCard
          icon={<Hash size={16} className="text-violet-500" />}
          label="Sessions"
          value={String(t.sessionCount)}
        />
        <StatCard
          icon={<Mountain size={16} className="text-stone-500" />}
          label="Elevation"
          value={`+${t.elevationM} m`}
        />
        <StatCard
          icon={<Gauge size={16} className="text-amber-500" />}
          label="Avg / week"
          value={`${t.avgKmPerWeek} km`}
        />
        {t.calories > 0 && (
          <>
            <StatCard
              icon={<Flame size={16} className="text-orange-500" />}
              label="Calories"
              value={`${(t.calories / 1000).toFixed(1)}k kcal`}
            />
            <StatCard
              icon={<Flame size={16} className="text-red-500" />}
              label="Kcal / week"
              value={String(t.caloriesPerWeek)}
            />
          </>
        )}
      </div>

      <MonthlyVolumeChart data={yearData.monthlyVolume} typesPresent={yearData.typesPresent} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaceTrendChart data={yearData.paceTrend} />
        <EfficiencyChart data={yearData.efficiencyTrend} />
        <HrTrendChart data={yearData.hrTrend} />
        <ZoneDistributionChart data={yearData.zoneDistribution} />
        <EasyHardChart data={yearData.easyHardSplit} />
        <CadenceTrendChart data={yearData.cadenceTrend} />
        <LongRunsChart data={yearData.longRuns} />
      </div>
    </div>
  )
}
