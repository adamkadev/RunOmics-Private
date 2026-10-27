'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function beyondOneLine(el: HTMLElement): boolean {
  const style = getComputedStyle(el)
  const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || el.clientHeight
  return el.scrollHeight > line * 1.5
}

/** `className` sets the first line's font and leading: one `1lh` of it is the collapsed height. */
export function CollapsibleNote({ label, className, testId, children }: { label: string; className?: string; testId?: string; children: ReactNode }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    if (ref.current) setOverflows(beyondOneLine(ref.current))
  }, [children])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setOverflows(beyondOneLine(el)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative">
      <div ref={ref} id={id} className={cn(className, 'pr-5', !open && 'max-h-[1lh] overflow-hidden')} data-testid={testId}>
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={label}
          onClick={() => setOpen((was) => !was)}
          className={cn(className, 'absolute inset-0 flex cursor-pointer items-start justify-end rounded-[inherit] text-muted-foreground')}
          data-testid="note-toggle"
        >
          <ChevronDown size={14} aria-hidden className={cn('mt-[calc((1lh-14px)/2)] shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
