'use client'

import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { CardTitle } from '@/components/ui/SectionLabel'
import { cn } from '@/lib/utils'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

/**
 * A chart card's takeaway - the one sentence that says what the picture means.
 *
 * It used to render at text-caption (11px) *under* the chart, and under it sat
 * the definition footnote at text-xs (12px), so every card set its
 * documentation larger than the conclusion that documentation was burying. The
 * reading leads the card now, as the subhead under its title.
 */
export function ChartReading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mb-3 text-footnote leading-snug text-muted-foreground', className)}>
      {children}
    </p>
  )
}

/**
 * One plotted series named in the legend, carrying its current value in the
 * series' own colour. Lived in TrainingLoadChart until Training Status needed
 * the same thing to name its chronic and acute lines.
 */
export function LegendValue({
  label,
  value,
  color,
  signed = false,
}: {
  label: string
  value?: number | null
  color: string
  signed?: boolean
}) {
  const rounded = value === null || value === undefined ? null : Math.round(value)
  return (
    <span className="text-xs font-bold" style={{ color }}>
      {label}
      {rounded !== null && ` ${signed ? formatDelta(rounded) : rounded}`}
    </span>
  )
}

/**
 * One chart card's header: its name, what its values are counted in, its own
 * controls, and - behind an (i) - the definition of what is being plotted.
 *
 * The definition is reference material: needed once, then never again. Left as
 * permanent ink at the foot of the card it competed with the reading for the
 * last thing the eye landed on. The disclosure is the one already shipping in
 * LoadRiskPanel - an aria-expanded button next to the label and a paragraph
 * that exists only while open.
 */
export function ChartCardHead({
  title,
  unit,
  footnote,
  controls,
  className,
}: {
  title: ReactNode
  /** What the plotted values are counted in, shown beside the title so the
   *  axis numbers are not the only place the reader can look for it. */
  unit?: string
  footnote?: ReactNode
  controls?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('mb-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <CardTitle>
            {title}
            {unit && <span className="ml-1.5 text-caption font-medium text-subtle">· {unit}</span>}
          </CardTitle>
          {footnote && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={t.analytics.aboutChart}
              className={cn(
                'hit-44 shrink-0 rounded-full p-0.5 transition-colors active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                open ? 'text-foreground' : 'text-subtle hover:text-muted-foreground',
              )}
            >
              <Info size={14} />
            </button>
          )}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      {open && footnote && <p className="mt-2 text-xs leading-snug text-subtle">{footnote}</p>}
    </div>
  )
}
