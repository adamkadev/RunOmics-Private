'use client'

import { useState } from 'react'
import type { ActivityType } from '@/domain/activity/types'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetSection } from '@/components/ui/Sheet'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { NO_HEAT_FILTERS, type HeatFilters } from './mapUtils'

interface Props {
  /** The types the runs have; the section shows when there is more than one. */
  types: readonly ActivityType[]
  years: readonly string[]
  value: HeatFilters
  /** Runs the map would show under these filters, for the button's count. */
  count: (filters: HeatFilters) => number
  onApply: (filters: HeatFilters) => void
  onClose: () => void
}

// 36 pt capsules on the system fill; the pick inverted (Liquid Glass v3, §6.6).
// Controls inside a glass sheet take fills, never glass.
const CHIP = 'hit-44 flex h-9 items-center rounded-full px-3.5 text-[15px] tracking-[-0.015rem] transition-colors'

/** One section's chips: "All" first, lit while none is ticked, then every option. */
function ChipGroup<T extends string>({
  title,
  options,
  picked,
  label,
  onChange,
}: {
  title: string
  options: readonly T[]
  picked: readonly T[]
  label: (option: T) => string
  onChange: (next: T[]) => void
}) {
  const chip = (text: string, on: boolean, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(CHIP, on ? 'bg-foreground px-4 font-semibold text-background' : 'bg-[var(--fill-3)] font-medium text-foreground')}
    >
      {text}
    </button>
  )
  return (
    <SheetSection title={title} label={title}>
      <div className="flex flex-wrap gap-2">
        {chip(t.pages.map.filters.all, picked.length === 0, () => onChange([]), '__all__')}
        {options.map((option) =>
          chip(
            label(option),
            picked.includes(option),
            () => onChange(picked.includes(option) ? picked.filter((p) => p !== option) : [...picked, option]),
            option,
          ),
        )}
      </div>
    </SheetSection>
  )
}

/**
 * The heatmap's filters (Heatmap Filters 1c, Oct 2026): a glass sheet that
 * floats 8 pt off the screen's edges, every type and year as wrapped chips,
 * any number ticked, "All" being none. Nothing changes on the map until
 * "Show N runs", which counts what it will show. A Liquid Glass v3 sheet
 * (ui/Sheet, G10): close, the title and Reset in its header, the 50 pt
 * prominent CTA concentric with its 47 pt corner.
 */
export function HeatFilterSheet({ types, years, value, count, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<HeatFilters>(value)
  const f = t.pages.map.filters

  return (
    <Sheet
      onClose={onClose}
      title={f.title}
      titleId="heat-filter-title"
      testId="heat-filter-sheet"
      action={{ label: f.reset, onClick: () => setDraft(NO_HEAT_FILTERS) }}
      footer={(close) => (
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            onApply(draft)
            close()
          }}
        >
          {f.show(count(draft))}
        </Button>
      )}
    >
      {types.length > 1 && (
        <ChipGroup
          title={t.pages.map.type}
          options={types}
          picked={draft.types}
          label={(type) => t.activityTypes[type]}
          onChange={(next) => setDraft((d) => ({ ...d, types: next }))}
        />
      )}
      <ChipGroup
        title={t.pages.map.year}
        options={years}
        picked={draft.years}
        label={(year) => year}
        onChange={(next) => setDraft((d) => ({ ...d, years: next }))}
      />
    </Sheet>
  )
}
