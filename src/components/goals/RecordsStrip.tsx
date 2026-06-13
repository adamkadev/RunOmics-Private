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
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Medal size={14} className="text-violet-500" />
        All-Time Records
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {records.map((r) => {
          const inner = (
            <>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{r.label}</p>
              {r.seconds !== null ? (
                <>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                    {formatDuration(r.seconds)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.official && (
                      <span className="ml-1 font-semibold text-violet-400">★</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-300 dark:text-gray-600">—</p>
              )}
            </>
          )

          return r.activityId ? (
            <Link
              key={r.key}
              href={`/activities/${r.activityId}`}
              className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={r.key}
              className="rounded-xl border border-dashed border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              {inner}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        ★ official race time · others auto-detected from activity data
      </p>
    </section>
  )
}
