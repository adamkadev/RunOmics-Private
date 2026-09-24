'use client'

import { useState } from 'react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { useToday } from '@/lib/useToday'
import { YearView } from './YearView'
import { GoalsHistory } from './GoalsHistory'
import { t } from '@/i18n'

interface Props {
  data: GoalsPageData
  /** The date the page was prerendered on; see useToday. */
  today: string
}

export function GoalsClient({ data, today: serverToday }: Props) {
  const today = useToday(serverToday)
  const { years, byYear, history } = data
  const [selectedYear, setSelectedYear] = useState(years[0])
  const yearData = selectedYear !== undefined ? byYear[selectedYear] : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {/* The year itself is redundant here - the 2026/2025 toggle right next
            to it already says which season is showing. */}
        <h1 className="min-w-0 text-display text-foreground">{t.goals.title}</h1>

        {years.length > 1 && (
          // Two mutually exclusive scopes on the whole screen, not a filter -
          // the segmented control Plan uses for its week/month switch, not
          // free-standing pills.
          <div
            role="tablist"
            aria-label={t.goals.title}
            className="flex shrink-0 gap-1 rounded-full border border-foreground/10 bg-foreground/[0.07] p-1"
          >
            {years.map((y) => (
              <button
                key={y}
                type="button"
                role="tab"
                aria-selected={y === selectedYear}
                onClick={() => setSelectedYear(y)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  y === selectedYear ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground'
                )}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {yearData ? (
        <YearView key={yearData.year} yearData={yearData} today={today} />
      ) : (
        <GlassSurface variant="card" className="rounded-2xl py-12 text-center">
          <p className="text-sm text-subtle">{t.goals.empty}</p>
        </GlassSurface>
      )}

      <GoalsHistory history={history} />
    </div>
  )
}
