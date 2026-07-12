'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RecordEntry, TopEfforts, EffortProgression } from '@/application/usecases/GetRecords'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { STATUS } from '@/lib/statusColors'
import { Badge } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Pill } from '@/components/ui/Pill'
import { t } from '@/i18n'

const PILL_ORDER = ['1k', '1mile', '5k', '10k', 'half', 'marathon']

const LABELS: Record<string, string> = {
  '1k': '1K',
  '1mile': '1M',
  '5k': '5K',
  '10k': '10K',
  half: 'Half',
  marathon: 'Marathon',
}

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short', year: '2-digit' })
}

function rankClass(i: number): string {
  if (i === 0) return cn('font-bold', STATUS.gold.text)
  if (i === 1) return cn('font-bold', STATUS.silver.text)
  if (i === 2) return cn('font-bold', STATUS.bronze.text)
  return 'text-subtle'
}

// PR trajectory over the last 12 months: running-best line ending in a dot,
// with the seconds shaved this year underneath. Improvement only - a flat
// line with "-0:00" is noise, so it renders nothing without a real drop.
function ProgressionSparkline({ progression }: { progression: EffortProgression }) {
  const { seconds, improvedSeconds } = progression
  if (improvedSeconds <= 0 || seconds.length < 3) return null

  const min = Math.min(...seconds)
  const max = Math.max(...seconds)
  const range = max - min || 1
  const w = 64
  const h = 22
  const xFor = (i: number) => (i / (seconds.length - 1)) * (w - 6) + 3
  const yFor = (s: number) => 3 + ((s - min) / range) * (h - 6)
  const points = seconds.map((s, i) => `${xFor(i).toFixed(1)},${yFor(s).toFixed(1)}`).join(' ')
  const lastX = xFor(seconds.length - 1)
  const lastY = yFor(seconds[seconds.length - 1]!)

  return (
    <span className="mt-2 flex items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-4 min-w-0 flex-1" aria-hidden>
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r={2.5} fill="var(--accent)" />
      </svg>
      <span className="shrink-0 text-[9px] font-semibold text-accent-text">
        {t.records.improvedThisYear(formatDuration(improvedSeconds))}
      </span>
    </span>
  )
}

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  mostRecentKey?: string | null
  predictions?: RacePrediction[]
  progressions?: Record<string, EffortProgression>
}

export function RecordsLeaderboard({ records, topEfforts, mostRecentKey = null, predictions = [], progressions = {} }: Props) {
  const pills = ['all', ...PILL_ORDER.filter((k) => topEfforts[k])]
  const [selected, setSelected] = useState('all')
  const predictionByKey = new Map(predictions.map((p) => [p.key, p]))

  const isAll = selected === 'all'
  const entries = isAll ? [] : (topEfforts[selected] ?? [])

  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t.records.title}
      </h2>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pills.map((k) => (
          <Pill
            key={k}
            as="button"
            variant={selected === k ? 'active' : 'neutral'}
            className="text-footnote font-semibold"
            onClick={() => setSelected(k)}
          >
            {k === 'all' ? t.records.all : (LABELS[k] ?? k)}
          </Pill>
        ))}
      </div>

      {isAll ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {records.filter((r) => r.key !== 'longest').map((r, i, arr) => {
              const spanFull = i === arr.length - 1 && arr.length % 2 !== 0

              const prediction = predictionByKey.get(r.key)

              if (r.seconds === null) {
                return (
                  <div
                    key={r.key}
                    className={cn('glass-card rounded-card-sm border-dashed p-5', spanFull && 'col-span-full')}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{r.label}</p>
                    <p className="mt-3 text-sm font-semibold text-foreground">{t.records.noRecordYet}</p>
                    {prediction ? (
                      <>
                        <p className="mt-1 text-xs text-subtle">{t.records.predictedFromFitness(formatDuration(prediction.predictedSeconds))}</p>
                        <Link href="/goals" className="mt-3 inline-block text-xs font-semibold text-accent-text">
                          {t.records.findRace(r.label)}
                        </Link>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-subtle">{t.records.notYetRun}</p>
                    )}
                  </div>
                )
              }

              const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)
              const riegelDeltaSeconds = prediction ? prediction.predictedSeconds - r.seconds : null

              const card = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                      {r.label}
                    </p>
                    <div className="flex items-center gap-1">
                      {r.key === mostRecentKey && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {t.records.mostRecent}
                        </Badge>
                      )}
                      {r.official && <span className="text-base text-amber-500">★</span>}
                    </div>
                  </div>
                  <p className="truncate text-title1 font-extrabold tracking-tight text-foreground">
                    {mainStat}
                  </p>
                  <p className="mt-1 text-xs font-medium text-subtle">
                    {r.distanceKm != null && <span>{formatDuration(r.seconds)} · </span>}
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.date && <span> · {shortDate(r.date)}</span>}
                  </p>
                  {progressions[r.key] && <ProgressionSparkline progression={progressions[r.key]!} />}
                  {riegelDeltaSeconds !== null && (
                    <p className={cn('mt-2 border-t border-foreground/[0.08] pt-2 text-xs font-medium', riegelDeltaSeconds >= 0 ? STATUS.success.text : STATUS.warning.text)}>
                      {riegelDeltaSeconds >= 0
                        ? t.records.riegelAhead(formatDuration(prediction!.predictedSeconds), formatDuration(riegelDeltaSeconds))
                        : t.records.riegelBehind(formatDuration(prediction!.predictedSeconds), formatDuration(-riegelDeltaSeconds))}
                    </p>
                  )}
                </>
              )

              return r.activityId ? (
                <Link
                  key={r.key}
                  href={`/activities/${r.activityId}`}
                  className={cn('glass-card rounded-card-sm p-5 transition-shadow hover:shadow-md', spanFull && 'col-span-full')}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={r.key}
                  className={cn('glass-card rounded-card-sm border-dashed p-5', spanFull && 'col-span-full')}
                >
                  {card}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <GlassSurface variant="card" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                <th className="py-2 pl-4 pr-2 text-left text-xs font-semibold text-subtle">
                  {t.records.leaderboard.rank}
                </th>
                <th className="py-2 px-2 text-left text-xs font-semibold text-subtle">
                  {t.records.leaderboard.time}
                </th>
                <th className="py-2 px-2 text-left text-xs font-semibold text-subtle">
                  {t.records.leaderboard.pace}
                </th>
                <th className="hidden py-2 px-2 text-left text-xs font-semibold text-subtle sm:table-cell">
                  {t.records.leaderboard.date}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.06]">
              {entries.map((e, i) => (
                <tr key={e.activityId} className="transition-colors hover:bg-foreground/[0.04]">
                  <td className="p-0" colSpan={4}>
                    <Link href={`/activities/${e.activityId}`} className="grid grid-cols-[auto_1fr_auto_auto] items-center">
                      <span className={cn('py-3.5 pl-4 pr-2 font-mono text-xs', rankClass(i))}>{i + 1}</span>
                      <span className="py-3.5 px-2">
                        <span className="block font-bold text-foreground">{formatDuration(e.seconds)}</span>
                        {e.eventName && (
                          <span className="block max-w-[140px] truncate text-xs text-subtle" title={e.eventName}>
                            {e.eventName}
                          </span>
                        )}
                      </span>
                      <span className="py-3.5 px-2 text-xs text-subtle">
                        {formatPace(Math.round(e.seconds / e.distanceKm))}
                      </span>
                      <span className="hidden py-3.5 px-2 text-xs text-subtle sm:block">
                        {shortDate(e.date)}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassSurface>
      )}
    </section>
  )
}
