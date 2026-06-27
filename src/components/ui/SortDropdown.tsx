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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const activeLabel = options.find((o) => o.value === sortBy)?.label

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-control border border-foreground/[0.12] bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/[0.10]"
      >
        {label}: {activeLabel}
        {order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[8rem] overflow-hidden rounded-xl border border-foreground/[0.12] bg-background/80 backdrop-blur-md py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value, o.value === sortBy && order === 'asc' ? 'desc' : o.value === sortBy ? 'asc' : 'desc')
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-foreground/[0.07]',
                o.value === sortBy ? 'bg-foreground/[0.10] text-foreground font-semibold' : 'text-foreground/70',
              )}
            >
              {o.label}
              {o.value === sortBy && (order === 'asc' ? <ArrowUp size={12} className="ml-auto" /> : <ArrowDown size={12} className="ml-auto" />)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
