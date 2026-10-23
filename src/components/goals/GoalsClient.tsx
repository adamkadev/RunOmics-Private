'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GoalsPageData } from '@/application/usecases/GetGoalsData'
import { cardClass } from '@/components/ui/Card'
import { useToday } from '@/lib/useToday'
import { YearView } from './YearView'
import type { SeasonBlock } from './SeasonTimeline'
import { GoalsHistory } from './GoalsHistory'
import { t } from '@/i18n'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'

export function defaultGoalsYear(years: readonly number[], today: string): number | undefined {
  const current = Number(today.slice(0, 4))
  return years.includes(current) ? current : years[0]
}

const STEP_BTN =
  'hit-44 flex size-9 items-center justify-center rounded-full text-foreground transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-35'

/** `years` runs newest first. */
export function YearStepper({ years, value, onChange }: { years: readonly number[]; value: number; onChange: (year: number) => void }) {
  const i = years.indexOf(value)
  const older = years[i + 1]
  const newer = i > 0 ? years[i - 1] : undefined
  return (
    // data-bar-segments: the compact top bar carries the stepper once it scrolls away, its value the data-bar-value.
    <div role="group" aria-label={t.goals.yearStepper} data-bar-segments="stepper" className={glassClass('regular', 'flex h-11 shrink-0 items-center gap-0.5 p-1')} data-testid="year-stepper">
      <GlassLayers />
      <button type="button" className={STEP_BTN} aria-label={t.goals.prevYear} disabled={older === undefined} onClick={() => older !== undefined && onChange(older)}>
        <ChevronLeft size={18} strokeWidth={2} aria-hidden />
      </button>
      <span data-bar-value className="min-w-[4ch] px-1 text-center text-sm font-semibold tabular-nums text-foreground" aria-live="polite">{value}</span>
      <button type="button" className={STEP_BTN} aria-label={t.goals.nextYear} disabled={newer === undefined} onClick={() => newer !== undefined && onChange(newer)}>
        <ChevronRight size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

interface Props {
  data: GoalsPageData
  /** The date the page was prerendered on. */
  today: string
  block?: SeasonBlock | null
  back?: ReactNode
}

export function GoalsClient({ data, today: serverToday, block = null, back }: Props) {
  const today = useToday(serverToday)
  const { years, byYear, history } = data
  const [selectedYear, setSelectedYear] = useState(() => defaultGoalsYear(years, serverToday))
  const hasYearStepper = years.length > 1 && selectedYear !== undefined
  const yearData = selectedYear !== undefined ? byYear[selectedYear] : undefined

  return (
    <div className="flex flex-col gap-3.5">
      {/* The stepper sits in the button row, not beside the title: there the title would wrap onto two lines. */}
      <header className="mb-1.5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          {back}
          {hasYearStepper && <YearStepper years={years} value={selectedYear} onChange={setSelectedYear} />}
        </div>
        <h1 data-bar-title={t.goals.barTitle} className="text-display text-foreground">{t.goals.title}</h1>
      </header>

      <div>
        {yearData ? (
          <YearView key={yearData.year} yearData={yearData} today={today} block={block} />
        ) : (
          <section className={cardClass({ className: 'py-12 text-center' })}>
            <p className="text-sm text-subtle">{t.goals.empty}</p>
          </section>
        )}
      </div>

      <GoalsHistory history={history} />
    </div>
  )
}
