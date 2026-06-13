'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  years: number[]
  selected: number
  onSelect: (year: number) => void
}

export function YearSelector({ years, selected, onSelect }: Props) {
  if (years.length <= 1) return null
  const currentIndex = years.indexOf(selected)

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSelect(years[currentIndex + 1])}
        disabled={currentIndex >= years.length - 1}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="flex gap-1">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onSelect(y)}
            className={`h-8 rounded-md px-3 text-sm font-medium transition-colors ${
              y === selected
                ? 'bg-emerald-500 text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSelect(years[currentIndex - 1])}
        disabled={currentIndex <= 0}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
