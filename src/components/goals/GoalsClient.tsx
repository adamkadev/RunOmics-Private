'use client'

import { useState } from 'react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { useToday } from '@/lib/useToday'
import { YearView } from './YearView'
import type { SeasonBlock } from './SeasonTimeline'
import { GoalsHistory } from './GoalsHistory'
import { t } from '@/i18n'

interface Props {
  data: GoalsPageData
  /** The date the page was prerendered on; see useToday. */
  today: string
  block?: SeasonBlock | null
}

export function GoalsClient({ data, today: serverToday, block = null }: Props) {
  const today = useToday(serverToday)
  const { years, byYear, history } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const yearTabs = useSegmentedTabs({ ids: years, value: selectedYear ?? 0, onChange: setSelectedYear })
  const hasYearTabs = years.length > 1
  const yearData = selectedYear !== undefined ? byYear[selectedYear] : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {/* The year itself is redundant here - the 2026/2025 toggle right next
            to it already says which season is showing. */}
        <h1 className="min-w-0 text-display text-foreground">{t.goals.title}</h1>

        {hasYearTabs && (
          // Two mutually exclusive scopes on the whole screen, not a filter -
          // the segmented control Plan uses for its week/month switch, not
          // free-standing pills.
          <SegmentedTabs
            tabs={yearTabs}
            items={years.map((y) => ({ id: y, label: y }))}
            label={t.goals.title}
            tabClassName="px-4 py-1.5 text-sm"
          />
        )}
      </div>

      <div {...(hasYearTabs ? yearTabs.panelProps : {})}>
        {yearData ? (
          <YearView key={yearData.year} yearData={yearData} today={today} block={block} />
        ) : (
          <GlassSurface variant="card" className="rounded-2xl py-12 text-center">
            <p className="text-sm text-subtle">{t.goals.empty}</p>
          </GlassSurface>
        )}
      </div>

      <GoalsHistory history={history} />
    </div>
  )
}
