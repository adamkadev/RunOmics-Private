'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import { formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Card, cardClass, Badge } from '@/components/ui/Card'
import { t } from '@/i18n'

const PILL_ORDER = ['1k', '1mile', '5k', '10k', 'half', 'marathon', 'longest']

const LABEL_COLOR: Record<string, string> = {
  '1k':     'text-blue-600 dark:text-blue-400',
  '1mile':  'text-cyan-600 dark:text-cyan-400',
  '5k':     'text-emerald-600 dark:text-emerald-400',
  '10k':    'text-amber-600 dark:text-amber-400',
  half:     'text-violet-600 dark:text-violet-400',
  marathon: 'text-rose-600 dark:text-rose-400',
  longest:  'text-orange-600 dark:text-orange-400',
}

const LABELS: Record<string, string> = {
  '1k': '1K',
  '1mile': '1 Mile',
  '5k': '5K',
  '10k': '10K',
  half: 'Half',
  marathon: 'Marathon',
  longest: 'Longest',
}

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short', year: '2-digit' })
}

function rankClass(i: number): string {
  if (i === 0) return 'font-bold text-amber-500 dark:text-amber-400'
  if (i === 1) return 'font-bold text-slate-400 dark:text-slate-300'
  if (i === 2) return 'font-bold text-amber-700 dark:text-amber-600'
  return 'text-subtle'
}

interface Props {
  records: RecordEntry[]
  topEfforts: TopEfforts
  mostRecentKey?: string | null
}

export function RecordsLeaderboard({ records, topEfforts, mostRecentKey = null }: Props) {
  const router = useRouter()
  const pills = ['all', ...PILL_ORDER.filter((k) => topEfforts[k])]
  const [selected, setSelected] = useState('all')

  const isAll = selected === 'all'
  const isLongest = selected === 'longest'
  const entries = isAll ? [] : (topEfforts[selected] ?? [])

  if (!records.some((r) => r.seconds !== null)) return null

  const allRecords = records.filter((r) => r.seconds !== null)

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Trophy size={14} className="text-violet-500 dark:text-violet-400" />
        {t.records.title}
      </h2>

      <div className="flex flex-wrap gap-2">
        {pills.map((k) => (
          <button
            key={k}
            onClick={() => setSelected(k)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              selected === k
                ? 'bg-accent text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {k === 'all' ? t.records.all : (LABELS[k] ?? k)}
          </button>
        ))}
      </div>

      {isAll ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {allRecords.map((r, i, arr) => {
              const spanFull = i === arr.length - 1 && arr.length % 2 !== 0
              const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds!)

              const card = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-1">
                    <p className={cn('text-xs font-bold uppercase tracking-wide', LABEL_COLOR[r.key] ?? 'text-subtle')}>
                      {r.label}
                    </p>
                    <div className="flex items-center">
                      {r.key === mostRecentKey && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          {t.records.mostRecent}
                        </Badge>
                      )}
                      {r.official && <span className="text-xs text-violet-400">★</span>}
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {mainStat}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {r.distanceKm != null && <span>{formatDuration(r.seconds!)} · </span>}
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.date && <span> · {shortDate(r.date)}</span>}
                  </p>
                </>
              )

              return r.activityId ? (
                <Link
                  key={r.key}
                  href={`/activities/${r.activityId}`}
                  className={cardClass({ clickable: true, className: spanFull ? 'col-span-full' : undefined })}
                >
                  {card}
                </Link>
              ) : (
                <div key={r.key} className={cardClass({ dashed: true, className: spanFull ? 'col-span-full' : undefined })}>
                  {card}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-subtle">{t.records.footnote}</p>
        </>
      ) : (
        <Card padding="none" overflow>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="py-2 pl-4 pr-2 text-left text-xs font-semibold text-subtle">
                  {t.records.leaderboard.rank}
                </th>
                <th className="py-2 px-2 text-left text-xs font-semibold text-subtle">
                  {isLongest ? t.records.leaderboard.dist : t.records.leaderboard.time}
                </th>
                <th className="py-2 px-2 text-left text-xs font-semibold text-subtle">
                  {t.records.leaderboard.pace}
                </th>
                <th className="hidden py-2 px-2 text-left text-xs font-semibold text-subtle sm:table-cell">
                  {t.records.leaderboard.date}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {entries.map((e, i) => (
                <tr
                  key={e.activityId}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => router.push(`/activities/${e.activityId}`)}
                >
                  <td className={cn('py-2.5 pl-4 pr-2 font-mono text-xs', rankClass(i))}>{i + 1}</td>
                  <td className="py-2.5 px-2">
                    <div className="font-bold text-foreground">
                      {isLongest ? formatDistance(e.distanceKm) : formatDuration(e.seconds)}
                    </div>
                    {e.eventName && (
                      <div className="max-w-[140px] truncate text-xs text-subtle" title={e.eventName}>
                        {e.eventName}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-subtle">
                    {formatPace(Math.round(e.seconds / e.distanceKm))}
                  </td>
                  <td className="hidden py-2.5 px-2 text-xs text-subtle sm:table-cell">
                    {shortDate(e.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  )
}
