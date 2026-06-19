'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortOrder = 'asc' | 'desc'

interface SortOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: SortOption<T>[]
  sortBy: T
  order: SortOrder
  onChange: (sortBy: T, order: SortOrder) => void
  label: string
}

export function SortDropdown<T extends string>({ options, sortBy, order, onChange, label }: Props<T>) {
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

  const activeLabel = options.find((o) => o.value === sortBy)?.label

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        {label}: {activeLabel}
        {order === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value, o.value === sortBy && order === 'asc' ? 'desc' : o.value === sortBy ? 'asc' : 'desc')
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                o.value === sortBy ? 'text-accent-text' : 'text-foreground',
              )}
            >
              {o.label}
              {o.value === sortBy && (order === 'asc' ? <ArrowUp size={11} className="ml-auto" /> : <ArrowDown size={11} className="ml-auto" />)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
