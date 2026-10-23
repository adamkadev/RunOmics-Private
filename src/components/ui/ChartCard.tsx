'use client'

import { useState, type ReactNode } from 'react'
import { InfoButton } from './GlossaryTerm'
import { CardTitle } from '@/components/ui/SectionLabel'
import { cn } from '@/lib/utils'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

export function ChartReading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mb-3 text-footnote leading-snug text-muted-foreground', className)}>
      {children}
    </p>
  )
}

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

export function ChartCardHead({
  title,
  unit,
  footnote,
  controls,
  className,
}: {
  title: ReactNode
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
            <InfoButton open={open} onToggle={() => setOpen((v) => !v)} label={t.analytics.aboutChart} />
          )}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      {open && footnote && <p className="mt-2 text-xs leading-snug text-subtle">{footnote}</p>}
    </div>
  )
}
