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
    // The menu floats over the page under its button (v4.17), so opening it
    // never pushes the header - or the list - down.
    <div ref={ref} className="relative flex min-w-0 flex-col items-end">
      {/* The arrow says "sort", so the word did not need to. The current key
          stays on screen though: an icon alone hides what the list is ordered by,
          and that is the one thing the control is reporting. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${label}: ${activeLabel ?? ''}`}
        // The v4.17 outline button, like the Map button beside it: one header style.
        className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border border-[var(--line-2)] bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
      >
        {order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {activeLabel}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-[var(--popover)] py-1 shadow-[var(--shadow-modal)]">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value, o.value === sortBy && order === 'asc' ? 'desc' : o.value === sortBy ? 'asc' : 'desc')
                setOpen(false)
              }}
              className={cn(
                'flex min-h-9 w-full items-center gap-2 px-3 text-left text-[13px] font-medium transition-colors hover:bg-[var(--surface-2)]',
                o.value === sortBy ? 'font-semibold text-foreground' : 'text-[var(--text-2)]',
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
