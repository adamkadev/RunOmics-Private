'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .reduce<(number | '…')[]>((acc, p, i, arr) => {
          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
          acc.push(p)
          return acc
        }, [])
        .map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-subtle">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`h-8 min-w-[2rem] rounded-md px-2 text-sm font-medium transition-colors ${
                page === p
                  ? 'bg-accent text-accent-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {p}
            </button>
          )
        )}

      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
