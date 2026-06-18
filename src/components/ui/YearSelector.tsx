'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  years: number[]
  selected: number | null  // null = all-time selected
  onSelect: (year: number | null) => void
  allTimeLabel?: string    // if provided, shows an all-time option at the bottom
  active?: boolean         // controls chip appearance (default: true)
}

export function YearSelector({ years, selected, onSelect, allTimeLabel, active = true }: Props) {
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

  if (years.length <= 1 && !allTimeLabel) return null

  const label = selected === null ? allTimeLabel : selected

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
          active
            ? 'bg-accent text-white'
            : 'border border-border bg-card text-muted-foreground hover:bg-muted',
        )}
      >
        {label}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[4.5rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { onSelect(y); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                y === selected ? 'text-accent-text' : 'text-foreground',
              )}
            >
              {y}
              {y === selected && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          ))}

          {allTimeLabel && (
            <>
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={() => { onSelect(null); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                  selected === null ? 'text-accent-text' : 'text-foreground',
                )}
              >
                {allTimeLabel}
                {selected === null && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
