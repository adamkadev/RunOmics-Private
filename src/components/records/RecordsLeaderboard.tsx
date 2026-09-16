'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { formatDate, formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

function medalDotClass(i: number): string | null {
  if (i === 0) return STATUS.gold.dot
  if (i === 1) return STATUS.silver.dot
  if (i === 2) return STATUS.bronze.dot
  return null
}

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  predictions?: RacePrediction[]
}

export function RecordsLeaderboard({ records, topEfforts, predictions = [] }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const predictionByKey = new Map(predictions.map((p) => [p.key, p]))

  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <SectionDivider as="h2">
        {t.records.title}
      </SectionDivider>

      <div className="flex justify-end px-0.5">
        <span className="text-caption text-subtle">{t.records.predictedHeader}</span>
      </div>

      <div>
        {records.filter((r) => r.key !== 'longest').map((r) => {
          const prediction = predictionByKey.get(r.key)

          if (r.seconds === null) {
            // Same geometry as the eight rows above it: the row is different
            // because it carries an action, and the muted name is the one
            // signal saying so - a fill, a border and a dashed edge were three
            // signals for one exception.
            return (
              <div key={r.key} className="border-b border-foreground/10 last:border-b-0">
                <div className="flex w-full items-center gap-3 px-0.5 py-[11px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-subtle">{r.label}</p>
                    <p className="mt-0.5 truncate text-xs text-subtle">{t.records.noRecordYet}</p>
                  </div>
                  {prediction ? (
                    <Link href="/goals" className="shrink-0 text-right">
                      <span className="block font-display text-base font-bold tabular-nums text-subtle">
                        {formatDuration(prediction.predictedSeconds)}
                      </span>
                      <span className="block text-[11.5px] font-semibold text-accent-text">
                        {t.records.findRace(r.label)}
                      </span>
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-subtle">{t.records.notYetRun}</span>
                  )}
                </div>
              </div>
            )
          }

          const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)
          const entries = topEfforts[r.key] ?? []
          const isExpanded = expandedKey === r.key

          return (
            <div key={r.key} className="border-b border-foreground/10 last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : r.key)}
                className="flex w-full items-center gap-3 px-0.5 py-[11px] text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-foreground">{r.label}</p>
                  <p className="mt-0.5 truncate text-xs text-subtle">
                    {r.date && <span>{formatDate(r.date, { style: 'bare' })}</span>}
                    <span> · {r.official ? t.records.raceTag : t.records.trainingTag}</span>
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-base font-bold tabular-nums text-foreground">
                    {mainStat}
                  </span>
                  <span className="block text-[11.5px] tabular-nums text-subtle">
                    {prediction ? formatDuration(prediction.predictedSeconds) : '–'}
                  </span>
                </span>
                <ChevronDown size={14} className={cn('shrink-0 text-subtle transition-transform', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded && entries.length > 0 && (
                <div className="glass-card mb-2 flex flex-col gap-2 rounded-card-sm px-4 py-2.5">
                  {entries.map((e, i) => {
                    const dotClass = medalDotClass(i)
                    return (
                      <Link
                        key={e.activityId}
                        href={`/activities/${e.activityId}`}
                        className="flex items-center gap-2.5 rounded-lg transition-colors hover:bg-foreground/[0.04]"
                      >
                        {/* 10px rather than 8: bronze is the darkest of the
                            three and the one that loses its hue first against
                            the card. */}
                        {dotClass ? (
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} />
                        ) : (
                          <span className="w-2.5 shrink-0 text-center text-xs text-subtle">{i + 1}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{formatDuration(e.seconds)}</p>
                          {/* Two efforts from the same session read as one row
                              twice without the date that separates them. */}
                          <p className="truncate text-caption text-subtle" title={e.eventName}>
                            {[e.eventName, formatDate(e.date, { style: 'bare' })].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className="shrink-0 text-caption text-subtle">
                          {formatPace(Math.round(e.seconds / e.distanceKm))}
                        </span>
                      </Link>
                    )
                  })}

                  {/* The key belongs to the dots above it, so it lives with
                      them: one card at a time, and only as far as the medals
                      actually go - a distance with two efforts keys two. */}
                  <div className="flex items-center gap-3 border-t border-foreground/10 pt-2">
                    {t.records.medalLegend.slice(0, entries.length).map((label, i) => (
                      <span key={label} className="flex items-center gap-1.5 text-caption text-subtle">
                        {/* The key paints the same 10px mark as the rows it
                            explains - at 6px bronze was too dark to read as
                            anything but another orange. */}
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', medalDotClass(i))} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
