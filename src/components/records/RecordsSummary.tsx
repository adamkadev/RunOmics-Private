import Link from 'next/link'
import { Medal, ArrowRight } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export function RecordsSummary({ records }: { records: RecordEntry[] }) {
  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Medal size={14} className="text-violet-500 dark:text-violet-400" />
          {t.records.title}
        </h2>
        <Link
          href="/records"
          className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          {t.common.viewAll}
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {records.map((r) => (
          <div key={r.key} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-subtle">{r.label}</p>
              {r.official && <span className="text-xs font-semibold text-violet-400">★</span>}
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {r.seconds !== null ? formatDuration(r.seconds) : '-'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
