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
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
} as const

/**
 * The bordered pill switch - Plan's week/month, Goals' years, the profile's
 * year/all-time, the activity's and Analytics' sections, Records - one recipe
 * where there were four, from 36 to 48 pt tall. `size` is sm (32) or md (40);
 * either way every tab has a 44 pt hit area. `tabClassName` still carries a
 * one-off size, and `fill` stretches the tabs across the row.
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
  items: readonly { id: T; label: ReactNode }[]
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
      className={cn('flex shrink-0 gap-1 rounded-full border border-foreground/10 bg-foreground/[0.07] p-1', fill && 'w-full', className)}
    >
      {items.map((item) => {
        const props = tabs.tabProps(item.id)
        return (
          <button
            key={item.id}
            {...props}
            className={cn(
              'hit-44 flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition-colors',
              size && SIZE_CLASS[size],
              // Fill mode shares the spare width out equally on top of each
              // label, with 12 pt padding as the floor: equal widths left
              // "Performance" touching its pill edge to edge (G21).
              fill && 'min-w-0 flex-auto px-3',
              tabClassName,
              props['aria-selected'] ? 'bg-accent text-accent-foreground' : 'text-subtle hover:text-foreground'
            )}
          >
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
