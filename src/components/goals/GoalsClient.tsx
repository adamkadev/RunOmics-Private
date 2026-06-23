'use client'

import { useState } from 'react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-foreground">{t.goals.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.analytics.season(selectedYear)}</p>
      </div>

      <YearSelector years={years} selected={selectedYear} onSelect={(y) => y !== null && setSelectedYear(y)} />

      <YearView yearData={byYear[selectedYear]} />

      <GoalsHistory history={history} />
    </div>
  )
}
