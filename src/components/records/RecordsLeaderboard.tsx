'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short', year: '2-digit' })
}

function medalDotClass(i: number): string | null {
  if (i === 0) return STATUS.gold.dot
  if (i === 1) return STATUS.silver.dot
  if (i === 2) return STATUS.bronze.dot
  return null
}

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  mostRecentKey?: string | null
  predictions?: RacePrediction[]
}

export function RecordsLeaderboard({ records, topEfforts, mostRecentKey = null, predictions = [] }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const predictionByKey = new Map(predictions.map((p) => [p.key, p]))

  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t.records.title}
      </h2>

      <div className="space-y-2">
        {records.filter((r) => r.key !== 'longest').map((r) => {
          const prediction = predictionByKey.get(r.key)

          if (r.seconds === null) {
            return (
              <div key={r.key} className="glass-card flex items-center gap-3 rounded-card-sm border-dashed px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{r.label}</p>
                  <p className="mt-0.5 truncate text-caption text-subtle">{t.records.noRecordYet}</p>
                </div>
                {prediction ? (
                  <Link href="/goals" className="shrink-0 text-right">
                    <span className="block text-xs font-semibold text-subtle">
                      {t.records.predictedFromFitness(formatDuration(prediction.predictedSeconds))}
                    </span>
                    <span className="block text-caption font-semibold text-accent-text">{t.records.findRace(r.label)}</span>
                  </Link>
                ) : (
                  <span className="shrink-0 text-caption text-subtle">{t.records.notYetRun}</span>
                )}
              </div>
            )
          }

          const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)
          const entries = topEfforts[r.key] ?? []
          const isExpanded = expandedKey === r.key

          return (
            <div
              key={r.key}
              className={cn(
                'overflow-hidden rounded-card-sm transition-colors',
                isExpanded ? 'border border-accent/35 bg-accent/[0.05]' : 'glass-card'
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : r.key)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{r.label}</p>
                  <p className="mt-0.5 truncate text-caption text-subtle">
                    {r.date && <span>{shortDate(r.date)}</span>}
                    {r.key === mostRecentKey && <span> · {t.records.mostRecent}</span>}
                    {r.official && <span> · {t.records.raceTag}</span>}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-bold tabular-nums text-foreground">
                  {mainStat}
                </span>
                <ChevronDown size={14} className={cn('shrink-0 text-subtle transition-transform', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded && entries.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-accent/15 px-4 pb-3 pt-2.5">
                  {entries.map((e, i) => {
                    const dotClass = medalDotClass(i)
                    return (
                      <Link
                        key={e.activityId}
                        href={`/activities/${e.activityId}`}
                        className="flex items-center gap-2.5 rounded-lg transition-colors hover:bg-foreground/[0.04]"
                      >
                        {dotClass ? (
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} />
                        ) : (
                          <span className="w-2 shrink-0 text-center font-mono text-caption text-subtle">{i + 1}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{formatDuration(e.seconds)}</p>
                          {e.eventName && (
                            <p className="truncate text-caption text-subtle" title={e.eventName}>
                              {e.eventName}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-caption text-subtle">
                          {formatPace(Math.round(e.seconds / e.distanceKm))}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
