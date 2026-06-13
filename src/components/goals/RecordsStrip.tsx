import Link from 'next/link'
import { Medal } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'

interface Props {
  records: RecordEntry[]
}

export function RecordsStrip({ records }: Props) {
  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Medal size={14} className="text-violet-500 dark:text-violet-400" />
        All-Time Records
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {records.map((r) => {
          const inner = (
            <>
              <p className="text-xs font-semibold text-subtle">{r.label}</p>
              {r.seconds !== null ? (
                <>
                  <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                    {formatDuration(r.seconds)}
                  </p>
                  <p className="text-xs text-subtle">
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.official && (
                      <span className="ml-1 font-semibold text-violet-400">★</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-subtle">-</p>
              )}
            </>
          )

          return r.activityId ? (
            <Link
              key={r.key}
              href={`/activities/${r.activityId}`}
              className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-md"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={r.key}
              className="rounded-xl border border-dashed border-border bg-card p-4"
            >
              {inner}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-subtle">
        ★ official race time · others auto-detected from activity data
      </p>
    </section>
  )
}
