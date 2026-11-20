import type { ReturnProgress } from '@/application/usecases/GetReturnProgress'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDurationWords } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const WEEKS_SHOWN = 8
const BAR_AREA_PX = 56

/** "28/9", "5/10": a day and month that fit one line under a 36 pt column. */
function shortDay(iso: string): string {
  return new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}

export function ReturnProgressCard({ progress, today }: { progress: ReturnProgress; today: string }) {
  const r = t.returnProgress
  const now = new Date(`${today}T12:00:00`)
  const weeks = progress.weeks.slice(-WEEKS_SHOWN)
  const peak = Math.max(1, ...weeks.map((week) => week.runningSec))
  const thisWeekMinutes = Math.round((weeks.at(-1)?.runningSec ?? 0) / 60)

  return (
    <section className={cardClass({ className: 'space-y-3 py-3.5' })} data-testid="return-progress-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{r.cardTitle}</h2>
        <span className="text-xs text-muted-foreground">{r.since(formatDate(progress.firstDayBack, { now }))}</span>
      </div>

      {progress.runsSince === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="return-card-nothing-yet">{r.nothingYet}</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">{r.longest}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground" data-testid="return-card-longest">
              {/* Whole minutes run, rounded down as Progress counts them. */}
              {progress.longestSec > 0 ? formatDurationWords(Math.floor(progress.longestSec / 60) * 60) : '—'}
            </span>
          </div>

          <figure className="space-y-1.5">
            <figcaption className="flex items-baseline justify-between gap-3 text-sm text-muted-foreground">
              <span>{r.runningPerWeek}</span>
              {thisWeekMinutes > 0 && (
                <span className="font-semibold tabular-nums text-foreground" data-testid="return-card-this-week">{r.minutes(thisWeekMinutes)}</span>
              )}
            </figcaption>
            {/* Top-aligned columns of one bar height: a label on two lines can no longer lift its bar. */}
            <ol className="flex items-start gap-2">
              {weeks.map((week, i) => {
                const minutes = Math.round(week.runningSec / 60)
                const current = i === weeks.length - 1
                const label = `${r.weekOf(formatDate(week.weekStart, { style: 'bare', now }))}: ${r.minutes(minutes)}`
                return (
                  <li key={week.weekStart} className="flex max-w-9 flex-1 flex-col items-stretch gap-1" title={label} aria-label={label} data-testid="return-week">
                    <span className="flex items-end" style={{ height: BAR_AREA_PX }} aria-hidden>
                      <span
                        data-current={current || undefined}
                        className={cn(
                          'box-border block w-full rounded-t-[4px]',
                          current ? 'border-[1.5px] border-dashed border-accent bg-accent/15' : minutes === 0 ? 'bg-[var(--track)]' : 'bg-[var(--data-done)]',
                        )}
                        style={{ height: minutes > 0 || current ? Math.max(current ? 8 : 4, (week.runningSec / peak) * BAR_AREA_PX) : 2 }}
                      />
                    </span>
                    <span className="text-center text-[11px] tabular-nums text-muted-foreground" aria-hidden>{current && minutes === 0 ? '\u00a0' : minutes}</span>
                    <span
                      className={cn('text-center text-[11px] leading-tight', current ? 'font-semibold text-accent-text' : 'whitespace-nowrap text-muted-foreground')}
                      aria-hidden
                      data-testid="return-week-label"
                    >
                      {current ? r.thisWeek : shortDay(week.weekStart)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </figure>
        </>
      )}
    </section>
  )
}
