import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConsistencyScore, ConsistencyRating } from '@/application/usecases/GetConsistencyScore'
import { t } from '@/i18n'

const RATING_STYLE: Record<ConsistencyRating, { badge: string; text: string }> = {
  excellent: { badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', text: 'text-emerald-600 dark:text-emerald-400' },
  good:      { badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',             text: 'text-blue-600 dark:text-blue-400' },
  fair:      { badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',         text: 'text-amber-600 dark:text-amber-400' },
  low:       { badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',               text: 'text-zinc-500' },
}

export function ConsistencyCard({ data }: { data: ConsistencyScore }) {
  const s = t.consistencyScore
  const style = RATING_STYLE[data.rating]

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw size={14} className="text-blue-500 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
      </div>

      <div className="flex items-end justify-between">
        <span className={cn('text-3xl font-bold tabular-nums', style.text)}>
          {data.score}
          <span className="ml-0.5 text-base font-normal text-muted-foreground">/100</span>
        </span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', style.badge)}>
          {s.rating[data.rating]}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {s.detail(data.window, data.adherence)}
      </p>
    </div>
  )
}
