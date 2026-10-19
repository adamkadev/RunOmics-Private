import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { ACCENT_LIFT } from '@/components/consistency/consistencyMonthsView'
import { formatDate, formatKm, formatMonthShortYear, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { AllTimeMonth, AllTimeView, AllTimeYear } from '@/application/usecases/GetAllTime'

const TITLE = 'text-[15px] font-semibold text-foreground'

/** The three totals (3.0): left-aligned, equal columns. */
function Totals({ view }: { view: AllTimeView }) {
  const a = t.allTime
  return (
    <section className={cardClass()} data-testid="all-time-totals">
      <div className="grid grid-cols-3 gap-3">
        {[
          [formatKm(view.km), a.km],
          [String(view.runs), a.runs],
          [formatKm(view.hours), a.hours],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 text-left">
            <p className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">{value}</p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** A change in percent with its sign: "+12%", "−8%". */
function signedPercent(pct: number): string {
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${formatPercent(Math.abs(pct))}`
}

/**
 * The years by km a month (3.0), fair to a first year that started late:
 * this year in the accent with its change on last year, the others in the
 * band grey; their totals in a footnote.
 */
export function YearRows({ years, currentYear }: { years: AllTimeYear[]; currentYear: number }) {
  const best = Math.max(1, ...years.map((y) => y.kmPerMonth))
  const newestFirst = [...years].reverse()
  const current = years.find((y) => y.year === currentYear)
  const previous = years.find((y) => y.year === currentYear - 1)
  const changePct = current && previous && previous.kmPerMonth > 0 ? Math.round((current.kmPerMonth / previous.kmPerMonth - 1) * 100) : null
  return (
    <>
      <ul className="flex flex-col gap-3" data-testid="year-rows">
        {newestFirst.map((y) => {
          const isCurrent = y.year === currentYear
          return (
            <li
              key={y.year}
              className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3"
              aria-label={t.allTime.yearLabel(y.year, formatKm(y.kmPerMonth))}
              data-testid="year-row"
            >
              <span className={cn('text-[13px] tabular-nums', isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground')}>{y.year}</span>
              <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-[var(--track)]">
                <span
                  className="block h-full rounded-full"
                  data-testid="year-bar"
                  style={{ width: `${(y.kmPerMonth / best) * 100}%`, background: isCurrent ? 'var(--accent)' : 'var(--band)' }}
                />
              </span>
              <span className="flex items-baseline justify-end gap-1.5 text-right tabular-nums" aria-hidden>
                <span className={cn('text-[15px]', isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground')}>{formatKm(y.kmPerMonth)}</span>
                {isCurrent && changePct !== null && (
                  <span
                    className={cn('text-[11px] font-semibold', changePct > 0 ? 'text-[var(--pos)]' : changePct < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground')}
                    data-testid="year-change"
                  >
                    {signedPercent(changePct)}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[12.5px] text-muted-foreground" data-testid="year-totals">
        {newestFirst.map((y, i) => (
          <span key={y.year} className="whitespace-nowrap">
            {i > 0 && <span aria-hidden>{'  ·  '}</span>}
            {t.allTime.yearTotals(formatKm(y.km), y.runs, y.year)}
          </span>
        ))}
      </p>
    </>
  )
}

/** The monthly chart's height, in px. */
const MONTHLY_H = 110
/** The months it draws (3.0): a year and a half. */
const MONTHS_SHOWN = 18
/** Round steps for its scale, in km. */
const SCALE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]
/** Lines up the side at most: on a 110 px chart, more would crowd it. */
const SCALE_LINES = 3

/**
 * The monthly chart's scale (design review, Oct 2026; 3.0): the smallest
 * round step that needs three lines at most, and a top a half step over the
 * best month - 250 for a best of 236, its lines at 100 and 200 - so the best
 * month reaches near the top.
 */
export function monthlyScale(bestKm: number): { top: number; ticks: number[] } {
  const best = Math.max(1, bestKm)
  const step = SCALE_STEPS.find((s) => Math.ceil(best / s) <= SCALE_LINES) ?? Math.ceil(best / SCALE_LINES)
  const half = step % 2 === 0 ? step / 2 : step
  const top = Math.max(step, Math.ceil(best / half) * half)
  return { top, ticks: Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step) }
}

/** A month's initial under its bar: "O" for October. */
function initial(key: string): string {
  return formatDate(`${key}-01`, { precision: 'month', year: 'never' }).charAt(0).toUpperCase()
}

/**
 * The last 18 months (3.0): earlier years in the band grey, this year in the
 * accent, the best month the lifted accent with its km over it, and the
 * month still running a dashed accent outline. A line marks each new year.
 */
function MonthlyBars({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const shown = view.monthly.slice(-MONTHS_SHOWN)
  const best = shown.reduce<AllTimeMonth | null>((max, m) => (!max || m.km > max.km ? m : max), null)
  const now = shown.at(-1)?.partial ? shown.at(-1)! : null
  const scale = monthlyScale(best?.km ?? 0)
  const at = (km: number) => `${(km / scale.top) * 100}%`
  return (
    <section className={cardClass()} data-testid="all-time-monthly">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={TITLE}>{a.monthly}</h2>
        <span className="text-[12.5px] text-muted-foreground" data-testid="monthly-header">
          {best && best.km > 0 && a.best(formatMonthShortYear(`${best.key}-01`))}
          {best && best.km > 0 && now && ' · '}
          {now && (
            <span className="text-accent-text">
              {a.soFar(formatDate(`${now.key}-01`, { precision: 'month', year: 'never' }), formatKm(now.km))}
            </span>
          )}
        </span>
      </div>
      <div className="mt-4 flex gap-2" aria-hidden>
        {/* Round km up the left, each on a line across the bars. */}
        <div className="relative w-7 shrink-0 text-caption leading-none text-muted-foreground" style={{ height: MONTHLY_H }} data-testid="monthly-axis">
          {scale.ticks.map((km) => (
            <span key={km} className="absolute left-0 translate-y-1/2" style={{ bottom: at(km) }}>
              {formatKm(km)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: MONTHLY_H }}>
            {scale.ticks.map((km) => (
              <span key={km} data-testid="monthly-gridline" className="absolute inset-x-0 border-t border-border" style={{ bottom: at(km) }} />
            ))}
            <div className="relative flex h-full items-end gap-[3px]">
              {shown.map((m, i) => {
                const isBest = m === best && m.km > 0 && !m.partial
                const fill = isBest ? ACCENT_LIFT : m.year !== view.currentYear ? 'var(--band)' : 'var(--accent)'
                const style: CSSProperties = {
                  height: `${Math.max(3, Math.round((m.km / scale.top) * MONTHLY_H))}px`,
                  ...(m.partial ? { border: '1.5px dashed var(--accent)', background: 'transparent' } : { background: fill }),
                }
                return (
                  <div key={m.key} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    {/* The year's first month, after another year's: a line where the year turns. */}
                    {i > 0 && m.key.endsWith('-01') && (
                      <span data-testid="year-divider" className="absolute -bottom-9 -left-[2px] top-0 w-px bg-[var(--line-2)]" />
                    )}
                    {isBest && (
                      <span className="mb-1 text-caption font-semibold leading-none tabular-nums text-foreground" data-testid="best-value">
                        {formatKm(m.km)}
                      </span>
                    )}
                    <span
                      data-testid="month-bar"
                      data-month={m.key}
                      data-best={isBest || undefined}
                      className="box-border block w-full rounded-[3px]"
                      style={style}
                    />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-[3px] text-center text-caption leading-[14px] text-muted-foreground">
            {shown.map((m) => (
              <span key={m.key} className={cn('min-w-0 flex-1', m.partial && 'font-semibold text-accent-text')}>{initial(m.key)}</span>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px] text-caption leading-[14px] text-muted-foreground" data-testid="monthly-years">
            {shown.map((m, i) => (
              <span key={m.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                {i === 0 || m.key.endsWith('-01') ? m.year : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Longest run and biggest week (3.0): each opens what it names, the run or that week in Activities. */
function Bests({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const cells = [
    view.longestRun && {
      label: a.longestRun,
      value: `${formatKm(view.longestRun.km, 1)} ${t.units.km}`,
      date: view.longestRun.date,
      href: view.longestRun.activityId ? `/activities/${view.longestRun.activityId}` : '/activities',
    },
    view.biggestWeek && {
      label: a.biggestWeek,
      value: `${formatKm(view.biggestWeek.km)} ${t.units.km}`,
      date: view.biggestWeek.weekStart,
      href: `/activities?week=${view.biggestWeek.weekStart}`,
    },
  ].filter((cell): cell is { label: string; value: string; date: string; href: string } => !!cell)
  if (cells.length === 0) return null
  return (
    <section className={cardClass({ padding: 'none', overflow: true })} data-testid="all-time-bests">
      <div className="grid grid-cols-2 divide-x divide-border">
        {cells.map((cell) => (
          <Link key={cell.label} href={cell.href} className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]" data-testid="all-time-best">
            <span className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
              {cell.label}
              <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
            </span>
            <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{cell.value}</span>
            <span className="text-[12.5px] text-muted-foreground">{formatDate(cell.date, { style: 'bare', year: 'always' })}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function AllTime({ view }: { view: AllTimeView }) {
  const a = t.allTime
  return (
    <div className="flex flex-col gap-3">
      <Totals view={view} />

      <section className={cardClass()} data-testid="all-time-years">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className={TITLE}>{a.byYear}</h2>
          <span className="text-[12.5px] text-muted-foreground">{a.perMonth}</span>
        </div>
        <YearRows years={view.years} currentYear={view.currentYear} />
      </section>

      {view.monthly.length > 0 && <MonthlyBars view={view} />}
      <Bests view={view} />
    </div>
  )
}
