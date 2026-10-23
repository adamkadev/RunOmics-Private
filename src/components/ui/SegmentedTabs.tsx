'use client'

import { useContext, useId, type KeyboardEvent, type ReactNode } from 'react'
import { GlassLayers } from '@/components/ui/GlassSurface'
import { StickyStuckContext } from '@/components/ui/StickyBar'
import { cn } from '@/lib/utils'

const NEXT_KEY: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

/** Selection follows focus: every panel here is cheap to show. */
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
      // Only the selected panel is rendered; aria-controls must not name a missing id.
      'aria-controls': id === value ? panelId(id) : undefined,
      tabIndex: id === value ? 0 : -1,
      onClick: () => onChange(id),
    }),
    panelProps: { id: panelId(value), role: 'tabpanel' as const, 'aria-labelledby': tabId(value), tabIndex: 0 },
  }
}

export type SegmentedTabsState<T extends string | number> = ReturnType<typeof useSegmentedTabs<T>>

/** Thumb heights in a 3 pt-padded track: sm 26 in 32, md 34 in 40. */
const SIZE_CLASS = {
  sm: 'h-[26px] px-3 text-[13px]',
  md: 'h-[34px] px-4 text-[15px] tracking-[-0.015rem]',
} as const

const SEGMENTED_TRACK_SHAPE = 'flex shrink-0 gap-0.5 rounded-full p-[3px]'
export const SEGMENTED_TRACK_CLASS = `${SEGMENTED_TRACK_SHAPE} bg-[var(--segmented-track)]`
export const SEGMENTED_THUMB_CLASS = 'rounded-full bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]'
export const SEGMENTED_IDLE_CLASS = 'rounded-full font-medium text-[var(--text-2)] hover:text-foreground'
/** Grows from zero, so every segment is the same width whatever its label. */
export const SEGMENTED_FILL_SEGMENT_CLASS = 'min-w-0 flex-[1_1_0%] justify-center'

export function SegmentedTabs<T extends string | number>({
  tabs,
  items,
  label,
  size,
  fill = false,
  className,
  tabClassName,
  barMirror = false,
  onAura = false,
}: {
  tabs: SegmentedTabsState<T>
  /** `ariaLabel` reads a short label in full: "4W" on screen, "last 4 weeks" aloud. */
  items: readonly { id: T; label: ReactNode; ariaLabel?: string }[]
  label: string
  size?: keyof typeof SIZE_CLASS
  fill?: boolean
  className?: string
  tabClassName?: string
  /** The compact top bar carries a copy once this scrolls away, so it is glass at rest and the copy lands with no jump. */
  barMirror?: boolean
  /** Straight on the background glow. */
  onAura?: boolean
}) {
  const stuck = useContext(StickyStuckContext)
  const glass = barMirror || stuck === true
  return (
    <div
      {...tabs.listProps}
      aria-label={label}
      data-bar-segments={barMirror ? '' : undefined}
      data-variant={glass ? 'glass' : 'content'}
      className={cn(
        glass ? 'lg flex h-11 shrink-0 p-1' : onAura ? `on-aura ${SEGMENTED_TRACK_SHAPE}` : SEGMENTED_TRACK_CLASS,
        // A strip's glass fades in as it sticks; the bar's copy is glass from the start.
        glass && !barMirror && 'lg-stuck-in',
        fill && 'w-full',
        className,
      )}
    >
      {glass && <GlassLayers />}
      {items.map((item) => {
        const props = tabs.tabProps(item.id)
        return (
          <button
            key={item.id}
            {...props}
            aria-label={item.ariaLabel}
            className={cn(
              'hit-44 flex items-center justify-center whitespace-nowrap transition-colors',
              glass ? 'lg-press h-9 rounded-full px-3.5 text-[15px] text-foreground' : cn('rounded-full', size && SIZE_CLASS[size]),
              // Spare width shared on top of each label, not equal widths, so "Performance" never touches its pill's edges.
              fill && 'min-w-0 flex-auto px-1.5 min-[400px]:px-2.5 sm:px-3',
              !glass && tabClassName,
              glass && fill && 'px-1.5 min-[400px]:px-2.5',
              glass
                ? props['aria-selected']
                  ? 'bg-[var(--tab-pill)] font-semibold'
                  : 'font-medium'
                : props['aria-selected']
                  ? SEGMENTED_THUMB_CLASS
                  : SEGMENTED_IDLE_CLASS
            )}
          >
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
