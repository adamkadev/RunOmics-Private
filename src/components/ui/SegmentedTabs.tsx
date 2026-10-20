'use client'

import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const NEXT_KEY: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/**
 * The tab pattern, once. Six screens had copied role="tablist" markup with no
 * way to move between tabs from the keyboard and no panel for a screen reader
 * to land on. This gives any markup a roving tab stop (only the selected tab
 * is in the Tab order), Left/Right/Home/End to switch, and the ids that tie
 * each tab to its panel. Switching follows focus: every panel here is cheap
 * to show.
 */
export function useSegmentedTabs<T extends string | number>({
  ids,
  value,
  onChange,
}: {
  ids: readonly T[]
  value: T
  onChange: (id: T) => void
}) {
  const base = useId()
  const tabId = (id: T) => `${base}tab-${id}`
  const panelId = (id: T) => `${base}panel-${id}`

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = NEXT_KEY[event.key]
    const index = ids.indexOf(value)
    if (!step || index === -1) return
    const next = ids[step(index, ids.length)]
    if (next === undefined) return
    event.preventDefault()
    onChange(next)
    document.getElementById(tabId(next))?.focus()
  }

  return {
    listProps: { role: 'tablist' as const, onKeyDown },
    tabProps: (id: T) => ({
      id: tabId(id),
      role: 'tab' as const,
      type: 'button' as const,
      'aria-selected': id === value,
      // Only the selected tab's panel is rendered, and a reference to an id
      // that is not in the document is no reference at all.
      'aria-controls': id === value ? panelId(id) : undefined,
      tabIndex: id === value ? 0 : -1,
      onClick: () => onChange(id),
    }),
    panelProps: { id: panelId(value), role: 'tabpanel' as const, 'aria-labelledby': tabId(value), tabIndex: 0 },
  }
}

export type SegmentedTabsState<T extends string | number> = ReturnType<typeof useSegmentedTabs<T>>

const SIZE_CLASS = {
  sm: 'h-[30px] px-3 text-xs',
  md: 'h-9 px-4 text-sm',
} as const

/**
 * The quiet switch (v4.17) - Plan's week/month, Goals' years, the activity's
 * and Analytics' sections, Records - one recipe everywhere: an inset track
 * with a line, the selected tab lifted onto the card surface in text ink.
 * The accent fill is kept for real actions. `size` is sm (30, small ranges)
 * or md (36, page tabs); either way every tab has a 44 pt hit area.
 * `tabClassName` still carries a one-off size, and `fill` stretches the tabs
 * across the row.
 */
export function SegmentedTabs<T extends string | number>({
  tabs,
  items,
  label,
  size,
  fill = false,
  className,
  tabClassName,
}: {
  tabs: SegmentedTabsState<T>
  /** `ariaLabel` reads a short label in full: "4W" on screen, "last 4 weeks" aloud (3.1.0). */
  items: readonly { id: T; label: ReactNode; ariaLabel?: string }[]
  label: string
  size?: keyof typeof SIZE_CLASS
  fill?: boolean
  className?: string
  tabClassName?: string
}) {
  return (
    <div
      {...tabs.listProps}
      aria-label={label}
      className={cn('flex shrink-0 gap-0.5 rounded-[11px] border border-border bg-[var(--segmented-track)] p-[3px]', fill && 'w-full', className)}
    >
      {items.map((item) => {
        const props = tabs.tabProps(item.id)
        return (
          <button
            key={item.id}
            {...props}
            aria-label={item.ariaLabel}
            className={cn(
              'hit-44 flex items-center justify-center whitespace-nowrap rounded-lg transition-colors',
              size && SIZE_CLASS[size],
              // Fill mode shares the spare width out equally on top of each
              // label, with 12 pt padding as the floor: equal widths left
              // "Performance" touching its pill edge to edge (G21). 10 pt
              // on a phone, where 12 cut "Performance" at 360 pt (v4.17.2).
              fill && 'min-w-0 flex-auto px-1.5 min-[400px]:px-2.5 sm:px-3',
              tabClassName,
              // Selected is the card surface, lifted (v4.17).
              props['aria-selected']
                ? 'bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]'
                : 'font-medium text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
