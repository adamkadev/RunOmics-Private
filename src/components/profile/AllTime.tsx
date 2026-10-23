import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import { formatDate, formatKm, formatMonthShortYear, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { AllTimeMonth, AllTimeView, AllTimeYear } from '@/application/usecases/GetAllTime'

const TITLE = 'text-[15px] font-semibold text-foreground'

function Totals({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const cells: [string, string, string | null][] = [
    [a.distance, formatKm(view.km), t.units.km],
    [a.runs.charAt(0).toUpperCase() + a.runs.slice(1), String(view.runs), null],
    [a.time, formatKm(view.hours), a.hoursUnit],
  ]
  return (
    <section className={cardClass()} data-testid="all-time-totals">
      <div className="grid grid-cols-3 gap-3">
        {cells.map(([label, value, unit]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 text-left">
            <p className="text-[12.5px] text-muted-foreground">{label}</p>
            <p className="whitespace-nowrap text-2xl font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">
              {value}
              {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function signedPercent(pct: number): string {
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${formatPercent(Math.abs(pct))}`
}

export const YEARS_SHOWN = 3

export function YearRows({ years, currentYear, since }: { years: AllTimeYear[]; currentYear: number; since: string | null }) {
  const best = Math.max(1, ...years.map((y) => y.kmPerMonth))
  const newestFirst = [...years].reverse()
  const byYear = new Map(years.map((y) => [y.year, y]))
  const lateStart = since && since.slice(5, 7) !== '01' ? since : null
  const row = (y: AllTimeYear) => {
    const isCurrent = y.year === currentYear
    const prev = byYear.get(y.year - 1)
    const changePct = prev && prev.kmPerMonth > 0 ? Math.round((y.kmPerMonth / prev.kmPerMonth - 1) * 100) : null
    const from = lateStart && Number(lateStart.slice(0, 4)) === y.year ? formatDate(lateStart, { precision: 'month', year: 'never' }) : null
    return (
      <li
        key={y.year}
        className="grid grid-cols-[2.75rem_minmax(0,1fr)_5.5rem] items-center gap-x-3 gap-y-1"
        aria-label={t.allTime.yearLabel(y.year, formatKm(y.kmPerMonth))}
        data-testid="year-row"
      >
        <span className={cn('text-[15px] tabular-nums', isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{y.year}</span>
        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
          <span
            className="block h-full rounded-full"
            data-testid="year-bar"
            style={{ width: `${(y.kmPerMonth / best) * 100}%`, background: isCurrent ? 'var(--accent)' : 'var(--band)' }}
          />
        </span>
        <span className="flex items-baseline gap-2 tabular-nums" aria-hidden>
          <span className={cn('text-[15px]', isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground')}>{formatKm(y.kmPerMonth)}</span>
          {changePct !== null && (
            <span
              className={cn('text-[11px] font-semibold', changePct > 0 ? 'text-[var(--pos)]' : changePct < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground')}
              data-testid="year-change"
            >
              {signedPercent(changePct)}
            </span>
          )}
        </span>
        <span className="col-start-2 col-end-4 text-[11.5px] text-muted-foreground" data-testid="year-totals">
          {t.allTime.yearTotals(formatKm(y.km), y.runs)}
          {from && ` · ${t.allTime.fromMonth(from)}`}
        </span>
      </li>
    )
  }
  const head = newestFirst.slice(0, YEARS_SHOWN)
  const rest = newestFirst.slice(YEARS_SHOWN)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3" data-testid="year-rows">
        {head.map(row)}
      </ul>
      {rest.length > 0 && (
        <details className="group" data-testid="all-years">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-0.5 text-[13px] font-medium text-accent-text group-open:hidden [&::-webkit-details-marker]:hidden">
            {t.allTime.allYears}
            <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
          </summary>
          <ul className="flex flex-col gap-3">{rest.map(row)}</ul>
        </details>
      )}
    </div>
  )
}

/** In px. */
const MONTHLY_H = 110
const MONTHS_SHOWN = 18
/** In km. */
const SCALE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]
/** More lines would crowd a 110 px chart. */
const SCALE_LINES = 3

export function monthlyScale(bestKm: number): { top: number; ticks: number[] } {
  const best = Math.max(1, bestKm)
  const step = SCALE_STEPS.find((s) => Math.ceil(best / s) <= SCALE_LINES) ?? Math.ceil(best / SCALE_LINES)
  const half = step % 2 === 0 ? step / 2 : step
  const top = Math.max(step, Math.ceil(best / half) * half)
  return { top, ticks: Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step) }
}

function initial(key: string): string {
  return formatDate(`${key}-01`, { precision: 'month', year: 'never' }).charAt(0).toUpperCase()
}

function MonthlyBars({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const shown = view.monthly.slice(-MONTHS_SHOWN)
  const best = shown.filter((m) => !m.partial).reduce<AllTimeMonth | null>((max, m) => (!max || m.km > max.km ? m : max), null)
  const now = shown.at(-1)?.partial ? shown.at(-1)! : null
  const scale = monthlyScale(Math.max(best?.km ?? 0, now?.projectedKm ?? 0, now?.km ?? 0))
  const at = (km: number) => `${(km / scale.top) * 100}%`
  const px = (km: number) => `${Math.max(3, Math.round((km / scale.top) * MONTHLY_H))}px`
  const grid = { gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }
  const years = shown.reduce<{ year: number; months: number }[]>((list, m) => {
    const last = list.at(-1)
    if (last && last.year === m.year) last.months += 1
    else list.push({ year: m.year, months: 1 })
    return list
  }, [])
  return (
    <section className={cardClass()} data-testid="all-time-monthly">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={TITLE}>{a.monthly}</h2>
        {best && best.km > 0 && (
          <span className="text-[12.5px] text-muted-foreground" data-testid="monthly-header">
            {a.best(formatKm(best.km), formatMonthShortYear(`${best.key}-01`))}
          </span>
        )}
      </div>
      <div className="mt-4" aria-hidden>
        <div className="relative" style={{ height: MONTHLY_H }}>
          {scale.ticks.map((km) => (
            <span key={km} data-testid="monthly-gridline" className="absolute inset-x-0 border-t border-border" style={{ bottom: at(km) }}>
              <span className="absolute bottom-0.5 left-0 text-[11px] leading-none tabular-nums text-[var(--axis-text)]">{km}</span>
            </span>
          ))}
          <div className="relative grid h-full items-end gap-[3px]" style={{ ...grid, gridTemplateRows: `${MONTHLY_H}px` }}>
            {shown.map((m, i) => {
              const isBest = m === best && m.km > 0
              return (
                <div key={m.key} className="relative flex h-full min-w-0 flex-col items-center justify-end">
                  {i > 0 && m.key.endsWith('-01') && (
                    <span aria-hidden className="absolute -left-[2px] inset-y-0 w-px bg-[var(--line-2)]" data-testid="january-divider" />
                  )}
                  {m.partial && m.projectedKm !== null && m.projectedKm > m.km && (
                    <span className="mb-1 text-caption font-semibold leading-none tabular-nums text-accent-text" data-testid="month-projection">
                      {formatKm(m.projectedKm)}
                    </span>
                  )}
                  {isBest && (
                    <span className="mb-1 text-caption font-semibold leading-none tabular-nums text-foreground" data-testid="best-value">
                      {formatKm(m.km)}
                    </span>
                  )}
                  {m.partial ? (
                    <span
                      data-testid="month-bar"
                      data-month={m.key}
                      className="relative box-border block w-full rounded-[3px] border-[1.5px] border-dashed border-accent"
                      style={{ height: px(m.projectedKm ?? m.km) }}
                    >
                      <span data-testid="month-so-far" className="absolute inset-x-0 bottom-0 block rounded-[2px] bg-accent" style={{ height: px(m.km) }} />
                    </span>
                  ) : (
                    <span
                      data-testid="month-bar"
                      data-month={m.key}
                      data-best={isBest || undefined}
                      className="block w-full rounded-[3px]"
                      style={{ height: px(m.km), background: m.year !== view.currentYear ? 'var(--band)' : 'var(--accent)' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-1.5 grid gap-[3px] text-center text-caption leading-[14px] text-subtle" style={grid}>
          {shown.map((m) => (
            <span key={m.key} className={cn('min-w-0', m.partial && 'font-semibold text-accent-text')}>{initial(m.key)}</span>
          ))}
        </div>
        <div className="mt-2.5 grid gap-[3px] border-t border-border pt-2.5 text-caption leading-[14px] text-muted-foreground" style={grid} data-testid="monthly-years">
          {years.map((y) => (
            <span key={y.year} className="min-w-0 whitespace-nowrap" style={{ gridColumn: `span ${y.months}` }} data-testid="monthly-year">
              {y.year}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Bests({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const cells = [
    view.longestRun && {
      label: a.longestRun,
      value: `${formatKm(view.longestRun.km, 1)} ${t.units.km}`,
      sub: formatDate(view.longestRun.date, { style: 'bare', year: 'always' }),
      href: view.longestRun.activityId ? `/activities/${view.longestRun.activityId}` : '/activities',
    },
    view.biggestWeek && {
      label: a.biggestWeek,
      value: `${formatKm(view.biggestWeek.km)} ${t.units.km}`,
      sub: a.weekOf(formatDate(view.biggestWeek.weekStart, { style: 'bare', year: 'never' })),
      href: `/activities?week=${view.biggestWeek.weekStart}`,
    },
  ].filter((cell): cell is { label: string; value: string; sub: string; href: string } => !!cell)
  if (cells.length === 0) return null
  return (
    <section className={cardClass({ padding: 'none', overflow: true })} data-testid="all-time-bests">
      <div className="grid grid-cols-2 divide-x divide-border">
        {cells.map((cell) => (
          <Link key={cell.label} href={cell.href} className="flex flex-col gap-1.5 px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]" data-testid="all-time-best">
            <span className="flex items-center gap-0.5 text-[13px] text-muted-foreground">
              {cell.label}
              <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
            </span>
            <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{cell.value}</span>
            <span className="text-[12.5px] text-muted-foreground">{cell.sub}</span>
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
        <YearRows years={view.years} currentYear={view.currentYear} since={view.since} />
      </section>

      {view.monthly.length > 0 && <MonthlyBars view={view} />}
      <Bests view={view} />
    </div>
  )
}
