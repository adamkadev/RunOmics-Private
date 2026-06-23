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
}: Props) {
  if (years.length <= 1 && !allTimeLabel && !periods?.length) return null

  const activePeriodOption = periods?.find((p) => p.weeks === activePeriod)

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      {periods?.map((p) => (
        <Pill
          key={p.weeks}
          as="button"
          variant={p.weeks === activePeriod ? 'active' : 'neutral'}
          onClick={() => onSelectPeriod?.(p.weeks)}
        >
          {p.label}
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
}
