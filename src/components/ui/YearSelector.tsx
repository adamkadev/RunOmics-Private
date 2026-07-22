'use client'

import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/utils'

interface PeriodOption {
  weeks: number
  label: string
}

interface Props {
  years: number[]
  selected: number | null       // active year (null = all-time/period active)
  onSelect: (year: number | null) => void
  allTimeLabel?: string
  periods?: PeriodOption[]
  activePeriod?: number | null
  onSelectPeriod?: (weeks: number) => void
  yearGroupLabel?: string
  windowGroupLabel?: string
  /** Extra classes for the year row - e.g. `justify-end` in a header row. */
  className?: string
}

function GroupLabel({ children }: { children: string }) {
  return <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
}

// Horizontally scrollable pill row - scales to any number of years, unlike a
// 2-button toggle that breaks down past 2-3 options. The selected scope is a
// filled accent chip, the same selection language as the tab strip below it.
export function YearSelector({
  years,
  selected,
  onSelect,
  allTimeLabel,
  periods,
  activePeriod,
  onSelectPeriod,
  yearGroupLabel,
  windowGroupLabel,
  className,
}: Props) {
  if (years.length <= 1 && !allTimeLabel && !periods?.length) return null

  const activePeriodOption = periods?.find((p) => p.weeks === activePeriod)

  const yearRow = (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {years.map((y) => (
        <Pill
          key={y}
          as="button"
          variant={y === selected && !activePeriodOption ? 'accent' : 'neutral'}
          onClick={() => onSelect(y)}
        >
          {y}
        </Pill>
      ))}

      {allTimeLabel && (
        <Pill
          as="button"
          variant={selected === null && !activePeriodOption ? 'accent' : 'neutral'}
          onClick={() => onSelect(null)}
        >
          {allTimeLabel}
        </Pill>
      )}
    </div>
  )

  if (!periods?.length) return yearRow

  const windowRow = (
    <div className="flex gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {periods.map((p) => (
        <Pill
          key={p.weeks}
          as="button"
          variant={p.weeks === activePeriod ? 'accent' : 'neutral'}
          onClick={() => onSelectPeriod?.(p.weeks)}
        >
          {p.label}
        </Pill>
      ))}
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {yearGroupLabel && <GroupLabel>{yearGroupLabel}</GroupLabel>}
        {yearRow}
      </div>
      <div className="space-y-1">
        {windowGroupLabel && <GroupLabel>{windowGroupLabel}</GroupLabel>}
        {windowRow}
      </div>
    </div>
  )
}
