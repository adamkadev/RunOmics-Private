'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { formatDate, formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const ROW_GRID = 'grid grid-cols-[1fr_4.875rem_4.875rem] items-center gap-2'

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

  // One prediction is a fallback when it is the best itself: say so rather than
  // present it as a forecast (the Half and Marathon read the same to the second).
  const predictedCell = (best: number | null, prediction: RacePrediction | undefined) => {
    if (!prediction) return <span className="text-right text-sm text-subtle">–</span>
    const same = best !== null && Math.round(prediction.predictedSeconds) === Math.round(best)
    return (
      <span className={cn('text-right text-sm tabular-nums', same ? 'text-subtle' : 'text-muted-foreground')}>
        {same ? t.records.sameAsBest : formatDuration(prediction.predictedSeconds)}
      </span>
    )
  }

  return (
    <section className="space-y-3">
      <SectionDivider as="h2">
        {t.records.title}
      </SectionDivider>

      {/* Labelled columns, where a floating "best · predicted" caption used to
          key two unlabelled numbers per row. */}
      <div className="glass-card rounded-card-sm px-4 pb-1">
        <div className={cn(ROW_GRID, 'pb-2 pt-3 text-caption font-semibold uppercase tracking-[0.08em] text-subtle')}>
          <span>{t.records.cols.distance}</span>
          <span className="text-right">{t.records.cols.best}</span>
          <span className="text-right">{t.records.cols.predicted}</span>
        </div>
        {records.filter((r) => r.key !== 'longest').map((r) => {
          const prediction = predictionByKey.get(r.key)

          if (r.seconds === null) {
            return (
              <div key={r.key} className={cn(ROW_GRID, 'min-h-14.5 border-t border-border')}>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-subtle">{r.label}</p>
                  {/* The dash under Best already says there is no record, so
                      the line is free for the one thing to do about it. */}
                  {prediction ? (
                    <Link href="/goals" className="block truncate text-xs font-semibold text-accent-text">
                      {t.records.findRace(r.label)}
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground">{t.records.noRecordYet}</p>
                  )}
                </div>
                <span className="text-right text-base font-bold text-subtle">—</span>
                {predictedCell(null, prediction)}
              </div>
            )
          }

          const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)
          const entries = topEfforts[r.key] ?? []
          const isExpanded = expandedKey === r.key

          return (
            <div key={r.key} className="border-t border-border">
              {/* The whole row is the target - it opens the distance's
                  history - so the 16 pt chevron goes. */}
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : r.key)}
                aria-expanded={isExpanded}
                className={cn(ROW_GRID, 'min-h-14.5 w-full text-left')}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{r.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.date && <span>{formatDate(r.date, { style: 'bare' })}</span>}
                    <span> · {r.official ? t.records.raceTag : t.records.trainingTag}</span>
                  </p>
                </div>
                <span className="text-right text-base font-bold tabular-nums text-foreground">{mainStat}</span>
                {r.distanceKm != null ? <span /> : predictedCell(r.seconds, prediction)}
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
