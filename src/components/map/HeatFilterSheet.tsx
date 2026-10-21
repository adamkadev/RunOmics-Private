'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityType } from '@/domain/activity/types'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
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

const CHIP = 'flex h-10 items-center rounded-full px-4 text-[15px] font-semibold transition-colors'

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
      className={cn(CHIP, on ? 'bg-foreground text-background' : 'text-foreground shadow-[inset_0_0_0_1px_var(--glass-rim)]')}
    >
      {text}
    </button>
  )
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-2)]">{title}</h3>
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
    </section>
  )
}

/**
 * The heatmap's filters (Heatmap Filters 1c, Oct 2026): a glass sheet that
 * floats 8 pt off the screen's edges, every type and year as wrapped chips,
 * any number ticked, "All" being none. Nothing changes on the map until
 * "Show N runs", which counts what it will show.
 */
export function HeatFilterSheet({ types, years, value, count, onApply, onClose }: Props) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  const [draft, setDraft] = useState<HeatFilters>(value)
  const f = t.pages.map.filters

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  return createPortal(
    // Over the fullscreen map (z-50), as the chips' menus are.
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[60] flex items-end sm:items-center sm:justify-center"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="heat-filter-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div
        ref={trapRef}
        data-testid="heat-filter-sheet"
        className="sheet-glass glass-float relative m-2 flex max-h-[calc(100%-16px)] w-[calc(100%-16px)] animate-sheet-up flex-col gap-[18px] rounded-[40px] px-5 pt-3 sm:max-w-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)', ...sheetStyle }}
      >
        <div className="flex justify-center" {...handleProps}>
          <div className="h-[5px] w-9 rounded-full bg-foreground opacity-25" />
        </div>

        <div className="flex items-center justify-between">
          <h2 id="heat-filter-title" className="text-[22px] font-bold text-foreground">{f.title}</h2>
          <button type="button" onClick={() => setDraft(NO_HEAT_FILTERS)} className="hit-44 text-[15px] font-semibold text-accent-text">
            {f.reset}
          </button>
        </div>

        {/* The chips scroll on a short phone; the sheet itself does not. */}
        <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto" style={{ touchAction: 'pan-y' }}>
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
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(draft)
            close()
          }}
          className="h-[52px] w-full shrink-0 rounded-[26px] bg-accent text-[17px] font-bold text-accent-foreground transition-transform active:scale-[0.98]"
        >
          {f.show(count(draft))}
        </button>
      </div>
    </div>,
    document.body,
  )
}
