'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { SimilarRun, SimilarRunsData } from '@/application/usecases/GetSimilarRuns'
import type { SimilarRunPoint } from './SimilarRunsChart'
import { cardClass } from '@/components/ui/Card'
import { ChartFigure } from '@/components/ui/ChartFigure'
import { Medal } from 'lucide-react'
import { formatDate, formatDuration, formatPace } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const LIST_MAX_ROWS = 4

const loadChart = () => import('./SimilarRunsChart')
/** Recharts is 113 KB the card needs only once it opens; the empty box keeps the list from jumping. */
const SimilarRunsChart = dynamic(() => loadChart().then((m) => m.SimilarRunsChart), { loading: () => <div className="h-[120px]" /> })

// Ranked by pace, so the bold number is the pace; the total time is secondary.
function RunRow({ run, bestPace }: { run: SimilarRun; bestPace: number }) {
  const s = t.activity.similarRuns
  const deltaSec = Math.round(run.paceSecPerKm - bestPace)

  const content = (
    <>
      <span className="flex w-6 shrink-0 items-center justify-center text-xs font-bold tabular-nums text-muted-foreground">
        {run.rank === 1 ? <Medal size={14} strokeWidth={2.2} role="img" aria-label={s.fastest} /> : `#${run.rank}`}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', run.isCurrent ? 'font-semibold text-foreground' : 'text-foreground/80')}>
        {run.isCurrent ? s.thisRun : formatDate(run.date, { year: 'always' })}
      </span>
      <span className="flex flex-col items-end leading-tight">
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatPace(run.paceSecPerKm)}</span>
        <span className="text-caption tabular-nums text-subtle">{formatDuration(run.durationSeconds)}</span>
      </span>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-subtle">
        {deltaSec <= 0 ? s.record : s.paceDelta(deltaSec)}
      </span>
    </>
  )

  if (run.isCurrent) {
    return <li className="flex items-center gap-2.5 rounded-control bg-[var(--surface-2)] px-2 py-1.5">{content}</li>
  }

  return (
    <li>
      <Link
        href={`/activities/${run.id}`}
        className="flex min-h-11 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)]"
      >
        {content}
      </Link>
    </li>
  )
}

export function SimilarRuns({ data }: { data: SimilarRunsData }) {
  const s = t.activity.similarRuns
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const bestPaceLabel = formatPace(data.bestPaceSecPerKm)

  const chartData: SimilarRunPoint[] = data.runs.map((run) => ({
    id: run.id,
    // An 11px axis tick has no room for a weekday.
    label: formatDate(run.date, { style: 'bare', year: 'always' }),
    pace: run.paceSecPerKm,
    isCurrent: run.isCurrent,
  }))

  const byRank = [...data.runs].sort((a, b) => a.rank - b.rank)
  const listed = byRank.slice(0, LIST_MAX_ROWS)
  if (!listed.some((run) => run.isCurrent)) {
    listed[listed.length - 1] = byRank.find((run) => run.isCurrent)!
  }

  const current = data.runs.find((run) => run.isCurrent)
  const deltaSec = current ? Math.round(current.paceSecPerKm - data.bestPaceSecPerKm) : 0

  // Folded to one row, so other runs never come ahead of this one on Overview.
  return (
    <section className={cardClass({ padding: 'none' })}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onPointerDown={() => void loadChart()}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-foreground">{s.rowTitle(data.currentRank, data.count)}</span>
          <span className="block text-xs text-muted-foreground">
            {deltaSec <= 0 ? s.rowBest : s.rowDelta(deltaSec)}
          </span>
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-[18px] pt-3">
          <p className="mb-3 text-sm text-muted-foreground">{s.summary(data.count, data.currentRank)}</p>

          <ChartFigure summary={s.chartSummary(data.count, bestPaceLabel)}>
            <SimilarRunsChart data={chartData} bestPace={data.bestPaceSecPerKm} onSelect={(id) => router.push(`/activities/${id}`)} />
          </ChartFigure>

          <ul className="mt-3 space-y-0.5 border-t border-border pt-3">
            {listed.map((run) => (
              <RunRow key={run.id} run={run} bestPace={data.bestPaceSecPerKm} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
