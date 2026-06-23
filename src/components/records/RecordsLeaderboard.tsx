'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry, TopEfforts } from '@/application/usecases/GetRecords'
import { formatDuration, formatDistance, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
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
  if (i === 0) return 'font-bold text-amber-500 dark:text-amber-400'
  if (i === 1) return 'font-bold text-slate-400 dark:text-slate-300'
  if (i === 2) return 'font-bold text-amber-800 dark:text-amber-600'
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
  const entries = isAll ? [] : (topEfforts[selected] ?? [])

  if (!records.some((r) => r.seconds !== null)) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Trophy size={14} className="text-accent-text" />
        {t.records.title}
      </h2>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pills.map((k) => (
          <Pill
            key={k}
            as="button"
            variant={selected === k ? 'active' : 'neutral'}
            className="text-[13px] font-semibold"
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

              if (r.seconds === null) {
                return (
                  <div
                    key={r.key}
                    className={cn('glass-card rounded-2xl border-dashed p-4 opacity-60', spanFull && 'col-span-full')}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-subtle">{r.label}</p>
                    <p className="mt-3 text-sm text-subtle">{t.records.notYetRun}</p>
                  </div>
                )
              }

              const mainStat = r.distanceKm != null ? formatDistance(r.distanceKm) : formatDuration(r.seconds)

              const card = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-subtle">
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
                  <p className="text-[28px] font-extrabold tracking-tight text-foreground">
                    {mainStat}
                  </p>
                  <p className="mt-1 text-xs font-medium text-subtle">
                    {r.distanceKm != null && <span>{formatDuration(r.seconds)} · </span>}
                    {r.paceSecPerKm !== null && formatPace(r.paceSecPerKm)}
                    {r.date && <span> · {shortDate(r.date)}</span>}
                  </p>
                </>
              )

              return r.activityId ? (
                <Link
                  key={r.key}
                  href={`/activities/${r.activityId}`}
                  className={cn('glass-card rounded-2xl p-4 transition-shadow hover:shadow-md', spanFull && 'col-span-full')}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={r.key}
                  className={cn('glass-card rounded-2xl border-dashed p-4', spanFull && 'col-span-full')}
                >
                  {card}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <GlassSurface variant="card" className="overflow-hidden rounded-[22px]">
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
                <tr
                  key={e.activityId}
                  className="cursor-pointer transition-colors hover:bg-foreground/[0.04]"
                  onClick={() => router.push(`/activities/${e.activityId}`)}
                >
                  <td className={cn('py-2.5 pl-4 pr-2 font-mono text-xs', rankClass(i))}>{i + 1}</td>
                  <td className="py-2.5 px-2">
                    <div className="font-bold text-foreground">
                      {formatDuration(e.seconds)}
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
        </GlassSurface>
      )}
    </section>
  )
}
