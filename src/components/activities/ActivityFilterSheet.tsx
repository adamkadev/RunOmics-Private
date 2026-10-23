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
  /** The types ticked when the sheet opens. */
  types: FilterKind[]
  sort: ActivitySort
  /** Runs per type across the archive. */
  counts: ReadonlyMap<string, number>
  onApply: (types: FilterKind[], sort: ActivitySort) => void
  onClose: () => void
}

const GROUPS = Object.keys(FILTER_GROUPS) as (keyof typeof FILTER_GROUPS)[]

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
              // A long run is an easy run, so it takes its dot.
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
