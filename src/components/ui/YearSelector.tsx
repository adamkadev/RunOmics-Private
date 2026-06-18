'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PeriodOption {
  weeks: number
  label: string
}

interface Props {
  years: number[]
  selected: number | null       // year shown in button (null = all-time)
  onSelect: (year: number | null) => void
  allTimeLabel?: string
  periods?: PeriodOption[]
  activePeriod?: number | null
  onSelectPeriod?: (weeks: number) => void
}

export function YearSelector({
  years,
  selected,
  onSelect,
  allTimeLabel,
  periods,
  activePeriod,
  onSelectPeriod,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  if (years.length <= 1 && !allTimeLabel && !periods?.length) return null

  const activePeriodOption = periods?.find((p) => p.weeks === activePeriod)
  const buttonLabel = activePeriodOption?.label ?? (selected === null ? allTimeLabel : selected)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors"
      >
        {buttonLabel}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[5rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { onSelect(y); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                y === selected && !activePeriodOption ? 'text-accent-text' : 'text-foreground',
              )}
            >
              {y}
              {y === selected && !activePeriodOption && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
          ))}

          {periods && periods.length > 0 && (
            <>
              <div className="mx-2 my-1 border-t border-border" />
              {periods.map((p) => (
                <button
                  key={p.weeks}
                  onClick={() => { onSelectPeriod?.(p.weeks); setOpen(false) }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                    p.weeks === activePeriod ? 'text-accent-text' : 'text-foreground',
                  )}
                >
                  {p.label}
                  {p.weeks === activePeriod && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </>
          )}

          {allTimeLabel && (
            <>
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={() => { onSelect(null); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                  selected === null && !activePeriodOption ? 'text-accent-text' : 'text-foreground',
                )}
              >
                {allTimeLabel}
                {selected === null && !activePeriodOption && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
