'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs, useSegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Sheet, SheetSection } from '@/components/ui/Sheet'
import { TypeDot } from '@/components/ui/TypeDot'
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
 * and its count. Nothing changes behind the sheet until "Show N runs". A
 * Liquid Glass v3 sheet (ui/Sheet): it floats while it fits in three
 * quarters of the screen and goes large past that, glass either way (F18).
 */
export function ActivityFilterSheet({ types, sort, counts, onApply, onClose }: Props) {
  const [picked, setPicked] = useState<FilterKind[]>(types)
  const [pendingSort, setPendingSort] = useState<ActivitySort>(sort)
  const sortTabs = useSegmentedTabs({ ids: SORT_IDS, value: pendingSort, onChange: setPendingSort })
  const f = t.activities.filter

  const toggle = (type: FilterKind) =>
    setPicked((prev) => (prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]))

  return (
    <Sheet
      onClose={onClose}
      title={f.title}
      titleId="activity-filter-title"
      testId="activity-filter-sheet"
      action={{
        label: f.reset,
        onClick: () => {
          setPicked([])
          setPendingSort('newest')
        },
      }}
      footer={(close) => (
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            onApply(picked, pendingSort)
            close()
          }}
        >
          {/* With nothing ticked the button says what it opens, not a bare count (App Fixes 3d). */}
          {picked.length === 0 ? f.showAll(matchingCount(counts, picked)) : f.show(matchingCount(counts, picked))}
        </Button>
      )}
    >
      <div className="pt-2.5">
        <SegmentedTabs
          tabs={sortTabs}
          items={SORT_IDS.map((id) => ({ id, label: t.activities.sort[id] }))}
          label={t.activities.sort.label}
          size="md"
          fill
        />
      </div>

      {GROUPS.map((group) => (
        <SheetSection key={group} title={t.activities.groups[group]}>
          <ul className="inset-group [--row-inset:34px]">
            {FILTER_GROUPS[group].map((type) => {
              const checked = picked.includes(type)
              // The long run takes the easy run's dot: it is one (App Fixes 3d).
              const dotType = type === LONG_RUN ? 'Base' : type
              return (
                <li key={type}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(type)}
                    className="flex h-11 w-full items-center gap-3 text-left"
                  >
                    {/* Ticked, the accent; unticked, a 1.5 pt ring on the glass (F18). */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-[22px] shrink-0 items-center justify-center rounded-full transition-colors',
                        checked ? 'bg-accent text-accent-foreground' : 'shadow-[inset_0_0_0_1.5px_var(--radio-ring)]',
                      )}
                    >
                      {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                    <TypeDot type={dotType} size={7} />
                    <span className="min-w-0 flex-1 truncate text-[17px] tracking-[-0.027rem] text-foreground">{kindLabel(type)}</span>
                    <span className="text-[15px] tabular-nums text-muted-foreground">{counts.get(type) ?? 0}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </SheetSection>
      ))}
    </Sheet>
  )
}
