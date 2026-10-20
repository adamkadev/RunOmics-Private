'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import type { ActivityType } from '@/domain/activity/types'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TypeDot } from '@/components/ui/TypeDot'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { FILTER_GROUPS, LONG_RUN, SORT_IDS, kindLabel, matchingCount, type ActivitySort, type FilterKind } from './activityFilter'

interface Props {
  /** The types ticked when the sheet opens: the picked types, or the chip's group. */
  types: FilterKind[]
  sort: ActivitySort
  /** Runs per type across the archive. */
  counts: ReadonlyMap<string, number>
  onApply: (types: FilterKind[], sort: ActivitySort) => void
  onClose: () => void
}

const GROUPS = Object.keys(FILTER_GROUPS) as (keyof typeof FILTER_GROUPS)[]

/**
 * Filter & sort (3.0): the sort, then every type under its group with a tick
 * and its count. Nothing changes behind the sheet until "Show N runs".
 */
export function ActivityFilterSheet({ types, sort, counts, onApply, onClose }: Props) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  const [picked, setPicked] = useState<FilterKind[]>(types)
  const [pendingSort, setPendingSort] = useState<ActivitySort>(sort)
  const sortTabs = useSegmentedTabs({ ids: SORT_IDS, value: pendingSort, onChange: setPendingSort })
  const f = t.activities.filter

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  const toggle = (type: FilterKind) =>
    setPicked((prev) => (prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]))

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-filter-title"
    >
      <div className="absolute inset-0 bg-black/55" onClick={close} />

      <div
        ref={trapRef}
        className="relative flex max-h-full w-full animate-sheet-up flex-col rounded-t-[28px] border border-border sm:max-w-sm sm:rounded-[28px]"
        style={{ background: 'var(--raised)', boxShadow: 'var(--shadow-modal)', ...sheetStyle }}
        data-testid="activity-filter-sheet"
      >
        <div className="flex justify-center pb-2 pt-2.5" {...handleProps}>
          <div className="h-[5px] w-10 rounded-full" style={{ background: 'var(--muted-foreground)', opacity: 0.5 }} />
        </div>

        <div className="flex items-baseline justify-between px-5 pb-3">
          <h2 id="activity-filter-title" className="text-[17px] font-semibold text-foreground">{f.title}</h2>
          <button
            type="button"
            onClick={() => {
              setPicked([])
              setPendingSort('newest')
            }}
            className="hit-44 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {f.reset}
          </button>
        </div>

        {/* The list scrolls on a short phone; the sheet itself does not. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5" style={{ touchAction: 'pan-y' }}>
          <SegmentedTabs
            tabs={sortTabs}
            items={SORT_IDS.map((id) => ({ id, label: t.activities.sort[id] }))}
            label={t.activities.sort.label}
            size="md"
            fill
          />

          {GROUPS.map((group) => (
            <section key={group} className="mt-4">
              <h3 className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t.activities.groups[group]}
              </h3>
              <ul>
                {FILTER_GROUPS[group].map((type) => {
                  const checked = picked.includes(type)
                  // The long run takes the easy run's dot: it is one (App Fixes 3d).
                  const dotType = type === LONG_RUN ? 'Base' : type
                  return (
                    <li key={type} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(type)}
                        className="flex h-11 w-full items-center gap-3 text-left"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-[22px] shrink-0 items-center justify-center rounded-md border transition-colors',
                            checked ? 'border-accent bg-accent text-accent-foreground' : 'border-[var(--line-2)]',
                          )}
                        >
                          {checked && <Check size={14} strokeWidth={3} />}
                        </span>
                        <TypeDot type={dotType} size={7} />
                        <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{kindLabel(type)}</span>
                        <span className="text-[13px] tabular-nums text-muted-foreground">{counts.get(type) ?? 0}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="px-5 pt-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          <button
            type="button"
            onClick={() => {
              onApply(picked, pendingSort)
              close()
            }}
            className="h-[50px] w-full rounded-[25px] bg-accent text-[16px] font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
          >
            {/* With nothing ticked the button says what it opens, not a bare count (App Fixes 3d). */}
            {picked.length === 0 ? f.showAll(matchingCount(counts, picked)) : f.show(matchingCount(counts, picked))}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
