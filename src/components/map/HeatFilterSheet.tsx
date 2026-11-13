'use client'

import { useState } from 'react'
import type { RunKind } from '@/domain/activity/runKind'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetSection } from '@/components/ui/Sheet'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { activeFilterCount, NO_HEAT_FILTERS, type HeatFilters } from './mapUtils'

interface Props {
  types: readonly RunKind[]
  years: readonly string[]
  /** The area pill's name, which the count is of; null while it has only coordinates. */
  place: string | null
  value: HeatFilters
  count: (filters: HeatFilters) => number
  onApply: (filters: HeatFilters) => void
  onClose: () => void
  /** Heat or districts, switched at once: one sheet for what the map shows, so the map keeps one button for it. */
  layer?: { districts: boolean; onToggle: () => void } | null
}

// Controls inside a glass sheet take fills, never glass.
const CHIP = 'hit-44 flex h-9 items-center rounded-full px-3.5 text-[15px] tracking-[-0.015rem] transition-colors'

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

export function HeatFilterSheet({ types, years, place, value, count, onApply, onClose, layer = null }: Props) {
  const [draft, setDraft] = useState<HeatFilters>(value)
  const f = t.pages.map.filters

  return (
    <Sheet
      onClose={onClose}
      title={f.title}
      titleId="heat-filter-title"
      testId="heat-filter-sheet"
      action={{ label: f.reset, onClick: () => setDraft(NO_HEAT_FILTERS), disabled: activeFilterCount(draft) === 0 }}
      footer={(close) => (
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            onApply(draft)
            close()
          }}
        >
          {f.show(count(draft), place)}
        </Button>
      )}
    >
      {layer && (
        <SheetSection title={f.layer} label={f.layer}>
          <div className="flex flex-wrap gap-2" data-testid="layer-chips">
            {([false, true] as const).map((districts) => (
              <button
                key={String(districts)}
                type="button"
                aria-pressed={layer.districts === districts}
                data-testid={districts ? 'layer-districts' : 'layer-heat'}
                onClick={() => layer.districts !== districts && layer.onToggle()}
                className={cn(CHIP, layer.districts === districts ? 'bg-foreground px-4 font-semibold text-background' : 'bg-[var(--fill-3)] font-medium text-foreground')}
              >
                {districts ? f.layerDistricts : f.layerHeat}
              </button>
            ))}
          </div>
        </SheetSection>
      )}
      {types.length > 1 && (
        <ChipGroup
          title={t.pages.map.type}
          options={types}
          picked={draft.types}
          label={(kind) => t.pages.map.kinds[kind]}
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
