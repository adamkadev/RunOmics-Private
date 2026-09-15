import { t } from '@/i18n'

export interface SparseRow {
  label: string
  first: string
  last: string
  change?: string
}

/**
 * A window holding two or three readings draws a line that looks exactly like a
 * trend and carries none of the evidence for one. Show what is actually known -
 * where the metric started and where it is now - and leave the judgement to a
 * window with enough points to support it.
 */
export function SparseSeries({ rows, count }: { rows: SparseRow[]; count: number }) {
  return (
    <div className="py-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-0"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.label}</span>
          <span className="shrink-0 text-caption tabular-nums text-subtle">{row.first}</span>
          <span aria-hidden className="shrink-0 text-caption text-subtle">&rarr;</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{row.last}</span>
          {row.change && (
            <span className="w-14 shrink-0 text-right text-caption tabular-nums text-subtle">{row.change}</span>
          )}
        </div>
      ))}
      <p className="mt-3 text-caption leading-snug text-subtle">{t.chartWindow.sparse(count)}</p>
    </div>
  )
}

/** Builds one row from a series, or nothing when the series holds no readings. */
export function sparseRow(
  label: string,
  values: readonly unknown[],
  format: (value: number) => string,
): SparseRow | null {
  const nums = values.filter((v): v is number => typeof v === 'number')
  const first = nums[0]
  const last = nums[nums.length - 1]
  if (first === undefined || last === undefined) return null

  const change = last - first
  return {
    label,
    first: format(first),
    last: format(last),
    change:
      nums.length < 2 ? undefined : change === 0 ? '0' : `${change > 0 ? '+' : '\u2212'}${format(Math.abs(change))}`,
  }
}
