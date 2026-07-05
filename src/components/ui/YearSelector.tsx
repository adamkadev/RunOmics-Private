'use client'

import { Pill } from '@/components/ui/Pill'

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
  // Group captions ("Year" / "Window") - only rendered (and only needed) once
  // `periods` mixes a different semantic (rolling window) into the same control.
  yearGroupLabel?: string
  windowGroupLabel?: string
}

function GroupLabel({ children }: { children: string }) {
  return <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
}

// Horizontally scrollable pill row - scales to any number of years, unlike a
// 2-button toggle that breaks down past 2-3 options.
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
}: Props) {
  if (years.length <= 1 && !allTimeLabel && !periods?.length) return null

  const activePeriodOption = periods?.find((p) => p.weeks === activePeriod)

  const yearRow = (
    <div className="flex gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {years.map((y) => (
        <Pill
          key={y}
          as="button"
          variant={y === selected && !activePeriodOption ? 'active' : 'neutral'}
          onClick={() => onSelect(y)}
        >
          {y}
        </Pill>
      ))}

      {allTimeLabel && (
        <Pill
          as="button"
          variant={selected === null && !activePeriodOption ? 'active' : 'neutral'}
          onClick={() => onSelect(null)}
        >
          {allTimeLabel}
        </Pill>
      )}
    </div>
  )

  // No periods: single row, unchanged from before (e.g. Goals' year-only usage).
  if (!periods?.length) return yearRow

  const windowRow = (
    <div className="flex gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {periods.map((p) => (
        <Pill
          key={p.weeks}
          as="button"
          variant={p.weeks === activePeriod ? 'active' : 'neutral'}
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
