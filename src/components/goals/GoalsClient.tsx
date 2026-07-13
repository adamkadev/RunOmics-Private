'use client'

import { useState } from 'react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { YearSelector } from '@/components/ui/YearSelector'
import { YearView } from './YearView'
import { GoalsHistory } from './GoalsHistory'
import { t } from '@/i18n'

interface Props {
  data: GoalsPageData
}

export function GoalsClient({ data }: Props) {
  const { years, byYear, history } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const yearData = selectedYear !== undefined ? byYear[selectedYear] : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-foreground">{t.goals.title}</h1>
        {selectedYear !== undefined && (
          <p className="mt-0.5 text-sm text-muted-foreground">{t.analytics.season(selectedYear)}</p>
        )}
      </div>

      <YearSelector years={years} selected={selectedYear ?? null} onSelect={(y) => y !== null && setSelectedYear(y)} />

      {yearData ? (
        <YearView key={yearData.year} yearData={yearData} />
      ) : (
        <GlassSurface variant="card" className="rounded-2xl py-12 text-center">
          <p className="text-sm text-subtle">{t.goals.empty}</p>
        </GlassSurface>
      )}

      <GoalsHistory history={history} />
    </div>
  )
}
