import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDurationWords } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const WEEKS_SHOWN = 8
const BAR_AREA_PX = 56

export function ReturnProgressCard({ progress, today }: { progress: ReturnProgress; today: string }) {
  const r = t.returnProgress
  const now = new Date(`${today}T12:00:00`)
  const weeks = progress.weeks.slice(-WEEKS_SHOWN)
  const peak = Math.max(1, ...weeks.map((week) => week.runningSec))
  const thisWeek = weeks.at(-1)

  return (
    <section className={cardClass({ className: 'space-y-3 py-3.5' })} data-testid="return-progress-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn(EYEBROW_CLASS, 'text-accent-text')}>{r.cardTitle}</h2>
        <span className="text-xs text-muted-foreground">{r.since(formatDate(progress.breakEnd, { now }))}</span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{r.longest}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground" data-testid="return-card-longest">
          {progress.longestSec > 0 ? formatDurationWords(progress.longestSec) : '—'}
        </span>
      </div>

      <figure className="space-y-1.5">
        <figcaption className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
          <span>{r.runningPerWeek}</span>
          {thisWeek && <span className="font-semibold tabular-nums text-foreground">{r.minutes(Math.round(thisWeek.runningSec / 60))}</span>}
        </figcaption>
        <ol className="flex items-end gap-[2px]" style={{ height: BAR_AREA_PX }}>
          {weeks.map((week, i) => {
            const minutes = Math.round(week.runningSec / 60)
            const label = `${r.weekOf(formatDate(week.weekStart, { style: 'bare', now }))}: ${r.minutes(minutes)}`
            return (
              <li key={week.weekStart} className="flex h-full flex-1 items-end" title={label} aria-label={label} data-testid="return-week">
                <span
                  className={cn('block w-full rounded-t-[4px]', i === weeks.length - 1 ? 'bg-accent' : 'bg-accent/45')}
                  style={{ height: minutes > 0 ? Math.max(2, (week.runningSec / peak) * BAR_AREA_PX) : 0 }}
                />
              </li>
            )
          })}
        </ol>
      </figure>
    </section>
  )
}
