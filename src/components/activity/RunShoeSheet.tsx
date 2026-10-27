'use client'

import { Check } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { ShoeOption } from './RunShoe'

// Loaded when the sheet first opens: a visitor never downloads the picker.
export function RunShoeSheet({
  options,
  selected,
  picked,
  saving,
  onPick,
  onClose,
}: {
  options: ShoeOption[]
  selected: string | null
  /** Whether the owner's pick, rather than Garmin's shoe or the default, decides this run. */
  picked: boolean
  saving: boolean
  onPick: (gearId: string | null) => void
  onClose: () => void
}) {
  const s = t.activity.shoe
  return (
    <Sheet onClose={onClose} title={s.sheetTitle} titleId="run-shoe-title" testId="run-shoe-sheet">
      <div className="flex flex-col gap-1 pt-3">
        {options.map((option) => (
          <button
            key={option.gearId}
            type="button"
            disabled={saving}
            aria-pressed={option.gearId === selected}
            onClick={() => onPick(option.gearId)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-left text-[15px] text-foreground transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.dotColor }} />
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {option.gearId === selected && <Check size={16} aria-hidden className="shrink-0 text-accent-text" />}
          </button>
        ))}
        {picked && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onPick(null)}
            className={cn('mt-1 min-h-11 self-start px-2 text-sm font-medium text-accent-text disabled:opacity-60')}
          >
            {s.clearPick}
          </button>
        )}
        <p className="px-2 pt-2 text-xs text-muted-foreground">{s.countsAfterSync}</p>
      </div>
    </Sheet>
  )
}
