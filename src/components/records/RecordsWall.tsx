import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { Tooltip } from '@/components/ui/Tooltip'
import { t } from '@/i18n'

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short', year: '2-digit' })
}

export function RecordsWall({ records, currentTsb }: { records: RecordEntry[]; currentTsb: number | null }) {
  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Trophy size={14} className="text-violet-500 dark:text-violet-400" />
        {t.records.title}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {records.map((r) => {
          const card = (
            <>
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold text-subtle">{r.label}</p>
                {r.official && <span className="text-xs font-semibold text-violet-400">★</span>}
              </div>
              {r.seconds !== null ? (
                <>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)}
                  </p>
                  <p className="text-xs text-subtle">
                    {r.distanceKm != null && <span>{formatDuration(r.seconds)} · </span>}
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.date && <span> · {shortDate(r.date)}</span>}
                  </p>
                  {r.formAtPb && (
                    <p className="mt-1 text-xs text-subtle">
                      {t.records.formAtPb.fitness} {r.formAtPb.ctl}
                      {' · '}
                      <Tooltip content={t.records.formAtPb.formTooltip}>
                        <span className={r.formAtPb.tsb >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {t.records.formAtPb.form} {r.formAtPb.tsb >= 0 ? '+' : ''}{r.formAtPb.tsb}
                        </span>
                      </Tooltip>
                      {currentTsb !== null && (
                        <span className="text-subtle">
                          {' → '}
                          <span className={currentTsb >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                            {currentTsb >= 0 ? '+' : ''}{currentTsb}
                          </span>
                          {' '}{t.records.formAtPb.now}
                        </span>
                      )}
                    </p>
                  )}
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
              {card}
            </Link>
          ) : (
            <div key={r.key} className="rounded-xl border border-dashed border-border bg-card p-4">
              {card}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-subtle">{t.records.footnote}</p>
    </section>
  )
}
