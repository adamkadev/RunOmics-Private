import type { ConsistencyView, DayLevel } from './consistencyMonths'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/** Track, half accent, full accent: three steps a glance can separate. */
const LEVEL_CLASS: Record<DayLevel, string> = {
  rest: 'bg-[var(--heat-empty)]',
  run: 'bg-accent/50',
  long: 'bg-accent',
}

const LEGEND: DayLevel[] = ['rest', 'run', 'long']

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <GlassSurface variant="card" className="rounded-card-sm px-3.5 py-3">
      <div className="text-caption font-semibold uppercase tracking-wide text-subtle">{label}</div>
      <div className="mt-1 text-title2 font-bold tabular-nums text-foreground">{value}</div>
    </GlassSurface>
  )
}

export function ConsistencyMonths({ view }: { view: ConsistencyView }) {
  const c = t.consistency

  if (view.months.length === 0) {
    return (
      <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
        <p className="text-sm text-subtle">{c.empty}</p>
      </GlassSurface>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={c.activeDays} value={String(view.activeDays)} />
        <StatTile label={c.shareOfDays} value={`${view.sharePct}%`} />
      </div>

      <GlassSurface variant="card" className="rounded-card-sm px-4 py-3.5">
        <div className="flex flex-col gap-1">
          {view.months.map((month) => (
            <div
              key={month.key}
              role="img"
              aria-label={c.monthSummary(month.fullLabel, month.activeDays, month.longRuns)}
              className="flex h-4 items-center gap-2"
              data-testid="consistency-month"
            >
              <span aria-hidden className="w-11 shrink-0 whitespace-nowrap text-caption text-subtle">{month.label}</span>
              <div aria-hidden className="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-0.5">
                {month.cells.map((cell) => (
                  <span
                    key={cell.date}
                    data-level={cell.level ?? 'none'}
                    className={cn('h-2.5 rounded-[2px]', cell.level && LEVEL_CLASS[cell.level])}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-caption text-muted-foreground">
          {LEGEND.map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-[2px]', LEVEL_CLASS[level])} />
              {c.levels[level]}
            </span>
          ))}
        </div>
      </GlassSurface>
    </div>
  )
}
