'use client'

import { useState } from 'react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { YearSelector } from '@/components/ui/YearSelector'
import { YearView } from './YearView'

interface Props {
  data: GoalsPageData
}

export function GoalsClient({ data }: Props) {
  const { years, byYear } = data
  const [selectedYear, setSelectedYear] = useState(years[0])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals & PBs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{selectedYear} season</p>
        </div>
        <YearSelector years={years} selected={selectedYear} onSelect={setSelectedYear} />
      </div>

      <YearView yearData={byYear[selectedYear]} />
    </div>
  )
}
