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

/** Thumb heights in a 3 pt-padded track: sm 26 in 32, md 34 in 40 (Liquid Glass v3, G7). */
const SIZE_CLASS = {
  sm: 'h-[26px] px-3 text-[13px]',
  md: 'h-[34px] px-4 text-[15px] tracking-[-0.015rem]',
} as const

/**
 * The content-layer segmented recipe, for the controls drawn by hand that
 * must match it (Theme, Light background, the share card's options): a
 * capsule system-fill track with no line, a lifted capsule thumb.
 */
const SEGMENTED_TRACK_SHAPE = 'flex shrink-0 gap-0.5 rounded-full p-[3px]'
export const SEGMENTED_TRACK_CLASS = `${SEGMENTED_TRACK_SHAPE} bg-[var(--segmented-track)]`
export const SEGMENTED_THUMB_CLASS = 'rounded-full bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]'
export const SEGMENTED_IDLE_CLASS = 'rounded-full font-medium text-[var(--text-2)] hover:text-foreground'
/**
 * A segment of a track that spans its row in equal parts (the share card's
 * Route | Stats | Photo, round 2, F3): it grows from zero, so every segment
 * is the same width whatever its label, and the thumb fills its segment.
 */
export const SEGMENTED_FILL_SEGMENT_CLASS = 'min-w-0 flex-[1_1_0%] justify-center'

/**
 * The quiet switch (v4.17) - Plan's week/month, Goals' years, the activity's
 * and Analytics' sections, Records - one recipe everywhere. Liquid Glass v3
 * (G7): a capsule track in the system fill with no line, the selected tab a
 * lifted capsule in text ink, the others in text-2. The accent fill is kept
 * for real actions. `size` is sm (a 32 pt track, small ranges) or md (40,
 * page tabs); either way every tab has a 44 pt hit area.
 * `tabClassName` still carries a one-off size, and `fill` stretches the tabs
 * across the row.
 *
 * `barMirror` marks a header toggle (List | Map, Week | Month, 3M | 6M | 1Y):
 * it is glass at rest, as its copy in the compact bar is (Liquid Glass v2,
 * section 11) - a 44 pt capsule of 36 pt segments, 15 pt labels, the chosen
 * one on the tab bar's pill - so the bar's copy lands on it with no jump.
 * In a sticky strip (StickyBar) the control turns to the same glass while
 * the strip is pinned (Liquid Glass v3, G5).
 */
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
  /** `ariaLabel` reads a short label in full: "4W" on screen, "last 4 weeks" aloud (3.1.0). */
  items: readonly { id: T; label: ReactNode; ariaLabel?: string }[]
  label: string
  size?: keyof typeof SIZE_CLASS
  fill?: boolean
  className?: string
  tabClassName?: string
  /** The compact top bar carries this control once it scrolls away (data-bar-segments). */
  barMirror?: boolean
  /** Straight on the background glow (F6): the track frosted in light (globals.css .on-aura). */
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
      className={cn(glass ? 'lg flex h-11 shrink-0 p-1' : onAura ? `on-aura ${SEGMENTED_TRACK_SHAPE}` : SEGMENTED_TRACK_CLASS, fill && 'w-full', className)}
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
              // Fill mode shares the spare width out equally on top of each
              // label, with 12 pt padding as the floor: equal widths left
              // "Performance" touching its pill edge to edge (G21). 10 pt
              // on a phone, where 12 cut "Performance" at 360 pt (v4.17.2).
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
