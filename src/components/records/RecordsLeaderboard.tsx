'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'
import { EFFORT_LIST_FIRST, allEffortsLabel, effortGap, predictionGap } from './recordsView'

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_64px_56px_44px] items-center gap-2'
const ROW_GRID_NO_PREDICTION = 'grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2'

const DATE = { style: 'bare', year: 'always' } as const

function medalClass(i: number): string {
  if (i === 0) return cn(STATUS.gold.dot, 'text-black/80')
  if (i === 1) return cn(STATUS.silver.dot, 'text-black/80')
  if (i === 2) return cn(STATUS.bronze.dot, 'text-black/80')
  return 'bg-[var(--track)] text-muted-foreground'
}

// Within reach is the status the column reports, so only it takes the colour.
const GAP_TONE = {
  faster: 'text-delta-good',
  at: 'text-muted-foreground',
  slower: 'text-muted-foreground',
} as const

function PredictedCells({ best, prediction }: { best: number; prediction: RacePrediction | undefined }) {
  if (!prediction) return <><span /><span /></>
  const gap = predictionGap(best, prediction.predictedSeconds)
  return (
    <>
      <span className="text-right text-sm tabular-nums text-muted-foreground">{formatDuration(Math.round(prediction.predictedSeconds))}</span>
      <span data-testid="prediction-gap" className={cn('whitespace-nowrap text-right text-xs font-medium tabular-nums', GAP_TONE[gap.kind])}>
        {gap.text}
      </span>
    </>
  )
}

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  predictions?: RacePrediction[]
}

export function RecordsLeaderboard({ records, topEfforts, predictions = [] }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const predictionByKey = new Map(predictions.map((p) => [p.key, p]))

  if (!records.some((r) => r.seconds !== null)) return null
  const ranked = records.filter((r) => r.key !== 'longest')
  const missing = ranked.filter((r) => r.seconds === null)
  const missingText = t.records.missing(missing.map((r) => r.label), missing.some((r) => predictionByKey.has(r.key)))

  // Only the rows drawn: a prediction for a distance with no record yet left two empty columns.
  const predicted = ranked.some((r) => r.seconds !== null && predictionByKey.has(r.key))
  const grid = predicted ? ROW_GRID : ROW_GRID_NO_PREDICTION

  const toggle = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key)
    setShowAll(false)
  }

  return (
    <section className={cardClass({ padding: 'none', className: 'px-4 py-1' })}>
      <div className={cn(grid, EYEBROW_CLASS, 'border-b border-border py-2.5 text-muted-foreground')}>
        <span>{t.records.cols.distance}</span>
        <span className="text-right">{t.records.cols.best}</span>
        {predicted && (
          <>
            <span className="text-right">{t.records.cols.predicted}</span>
            <span className="text-right">{t.records.cols.gap}</span>
          </>
        )}
      </div>
      {ranked.filter((r): r is RecordEntry & { seconds: number } => r.seconds !== null).map((r, index) => {
        const prediction = predictionByKey.get(r.key)
        const divider = index > 0 && 'border-t border-border'
        const entries = topEfforts[r.key] ?? []
        const expandable = entries.length > 1
        const isExpanded = expandable && expandedKey === r.key
        const shown = showAll ? entries : entries.slice(0, EFFORT_LIST_FIRST)
        const best = entries[0]?.seconds ?? r.seconds

        const label = (
          <div className="min-w-0">
            <p className="truncate text-subhead font-semibold text-foreground">{r.label}</p>
            <p className="text-xs text-muted-foreground">
              {/* Training is the default, so only a race says what it was. */}
              {r.date && <span className="whitespace-nowrap">{formatDate(r.date, DATE)}</span>}
              {r.date && r.official && ' · '}
              {r.official && <span>{t.records.raceTag}</span>}
            </p>
          </div>
        )

        return (
          <div key={r.key} className={cn(divider)}>
            {expandable ? (
              <button
                type="button"
                onClick={() => toggle(r.key)}
                aria-expanded={isExpanded}
                className={cn(grid, 'min-h-14.5 w-full py-2.5 text-left')}
              >
                {label}
                <span className="text-right text-base font-bold tabular-nums text-foreground">{formatDuration(r.seconds)}</span>
                {predicted && <PredictedCells best={r.seconds} prediction={prediction} />}
              </button>
            ) : (
              <div className={cn(grid, 'min-h-14.5 py-2.5')}>
                {label}
                <span className="text-right text-base font-bold tabular-nums text-foreground">{formatDuration(r.seconds)}</span>
                {predicted && <PredictedCells best={r.seconds} prediction={prediction} />}
              </div>
            )}

            {isExpanded && (
              <div className="mb-2.5 flex flex-col rounded-[14px] border border-border bg-muted px-3 py-1" data-testid="effort-list">
                {shown.map((e, i) => {
                  const gap = effortGap(e.seconds, best)
                  return (
                    <Link
                      key={`${e.activityId}-${i}`}
                      href={`/activities/${e.activityId}`}
                      className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2.5 rounded-lg py-[7px] transition-colors hover:bg-foreground/[0.04]"
                    >
                      <span
                        data-testid="effort-rank"
                        className={cn('flex size-5 items-center justify-center rounded-full text-caption font-bold tabular-nums', medalClass(i))}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tabular-nums text-foreground">
                          {formatDuration(e.seconds)}
                          {gap && <span className="ml-1 text-xs font-medium text-muted-foreground">{gap}</span>}
                        </span>
                        {/* The date tells apart two efforts from the same session. */}
                        <span className="block truncate text-xs text-muted-foreground" title={e.eventName}>
                          {[e.eventName, formatDate(e.date, DATE)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  )
                })}
                {/* Activities has no effort filter, so the rest open here. */}
                {!showAll && entries.length > EFFORT_LIST_FIRST && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="border-t border-border pb-2 pt-1.5 text-left text-footnote font-semibold text-accent-text"
                  >
                    {allEffortsLabel(r.label, entries.length)}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {missing.length > 0 && (
        <div className="border-t border-border py-3" data-testid="records-missing">
          {missing.some((r) => predictionByKey.has(r.key)) ? (
            <Link href="/goals" className="block text-xs font-semibold text-accent-text text-pretty">{missingText}</Link>
          ) : (
            <p className="text-xs text-muted-foreground text-pretty">{missingText}</p>
          )}
        </div>
      )}
    </section>
  )
}
