import type { CSSProperties } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { AllTimeView, AllTimeYear } from '@/application/usecases/GetAllTime'

const TITLE = 'font-display text-body font-bold text-foreground'

/**
 * One row per year with a bar scaled to the best year (C6, v4.4b): the
 * current year in ink, its label too; past years in the band grey (v5.5 #16).
 * Bold km, then runs and hours. The Progress hub's All time card draws the
 * same rows, compact.
 */
export function YearRows({ years, currentYear, compact = false }: { years: AllTimeYear[]; currentYear: number; compact?: boolean }) {
  const best = Math.max(1, ...years.map((y) => y.km))
  const newestFirst = [...years].reverse()
  return (
    <ul className={cn(compact ? 'space-y-2' : 'space-y-3')} data-testid="year-rows">
      {newestFirst.map((y) => {
        const current = y.year === currentYear
        return (
          <li
            key={y.year}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3"
            aria-label={t.allTime.yearLabel(y.year, formatKm(y.km), y.runs, formatKm(y.hours))}
            data-testid="year-row"
          >
            {/* This year in ink, the others band grey (v5.5 #16): years are data. */}
            <span className={cn('font-display text-footnote font-bold tabular-nums', current ? 'text-foreground' : 'text-muted-foreground')}>{y.year}</span>
            <span aria-hidden className="block h-2.5 overflow-hidden rounded-full bg-[var(--track)]">
              <span
                className="block h-full rounded-full"
                data-testid="year-bar"
                style={{ width: `${(y.km / best) * 100}%`, background: current ? 'var(--accent)' : 'var(--band)' }}
              />
            </span>
            <span className="text-right text-footnote tabular-nums text-muted-foreground" aria-hidden>
              <span className="font-bold text-foreground">{formatKm(y.km)}</span> · {y.runs} · {formatKm(y.hours)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Totals({ view }: { view: AllTimeView }) {
  const a = t.allTime
  return (
    <GlassSurface variant="card" className="rounded-card-sm px-5 py-4" data-testid="all-time-totals">
      <div className="grid grid-cols-3 gap-2">
        {[
          [formatKm(view.km), a.km],
          [String(view.runs), a.runs],
          [formatKm(view.hours), a.hours],
        ].map(([value, label]) => (
          <div key={label}>
            <p className="font-display text-title1 font-bold leading-none tabular-nums text-foreground">{value}</p>
            <p className="mt-1.5 text-footnote text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}

/** The monthly chart's height, in pt. */
const MONTHLY_H = 96
/** Round steps for its scale, in km. */
const SCALE_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]
/** Lines up the side at most: on a 96 pt chart, more would crowd it. */
const SCALE_LINES = 3

/**
 * The monthly chart's scale (design review, Oct 2026): with none, no month
 * could be read but the best one named over the chart. The smallest round
 * step that needs three lines at most, the top rounded up to it - so every
 * line is a round figure and the best month still reaches near the top.
 */
export function monthlyScale(bestKm: number): { top: number; ticks: number[] } {
  const best = Math.max(1, bestKm)
  const step = SCALE_STEPS.find((s) => Math.ceil(best / s) <= SCALE_LINES) ?? Math.ceil(best / SCALE_LINES)
  const lines = Math.ceil(best / step)
  return { top: lines * step, ticks: Array.from({ length: lines }, (_, i) => (i + 1) * step) }
}

/** Every month since the first run: past years band grey, this year ink, and
 *  the month still running outlined in the accent, the one "now" (v5.5 #16). */
function MonthlyBars({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const scale = monthlyScale(view.bestMonth?.km ?? 0)
  const at = (km: number) => `${(km / scale.top) * 100}%`
  const years = [...new Set(view.monthly.map((m) => m.year))]
  return (
    <GlassSurface variant="card" className="rounded-card-sm px-5 py-4" data-testid="all-time-monthly">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={TITLE}>{a.monthly}</h2>
        {view.bestMonth && (
          <span className="text-footnote text-muted-foreground">
            {a.best(formatMonthShortYear(`${view.bestMonth.key}-01`), formatKm(view.bestMonth.km))}
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2" aria-hidden>
        {/* Round km up the left, as Analytics draws its pace axis, each on
            a line across the bars. */}
        <div className="relative w-8 shrink-0 text-caption leading-none text-muted-foreground" style={{ height: MONTHLY_H }} data-testid="monthly-axis">
          {scale.ticks.map((km) => (
            <span key={km} className="absolute right-0 translate-y-1/2" style={{ bottom: at(km) }}>
              {formatKm(km)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: MONTHLY_H }}>
          {scale.ticks.map((km) => (
            <span key={km} data-testid="monthly-gridline" className="absolute inset-x-0 border-t border-border" style={{ bottom: at(km) }} />
          ))}
          {/* Inset by the month-so-far ring, so the last bar's ring stays inside the gridlines (screen audit, Oct 2026). */}
          <div className="relative flex h-full items-end gap-1 px-[3px]">
            {view.monthly.map((m) => {
              const style: CSSProperties = {
                height: `${Math.max(3, Math.round((m.km / scale.top) * MONTHLY_H))}px`,
                // This year is the athlete's own data, the accent, as on Progress (screen audit, Oct 2026).
                background: m.year !== view.currentYear ? 'var(--band)' : 'var(--accent)',
                ...(m.partial ? { boxShadow: '0 0 0 1.5px var(--card), 0 0 0 3px var(--accent)' } : {}),
              }
              return <span key={m.key} data-testid="month-bar" data-month={m.key} className="block min-w-0 flex-1 rounded-[3px]" style={style} />
            })}
          </div>
        </div>
      </div>
      {/* The years under a divider, each spanning its own months. */}
      <div className="ml-10 mt-2 flex gap-1 border-t border-border pt-2 text-caption text-muted-foreground">
        {years.map((year) => {
          const months = view.monthly.filter((m) => m.year === year)
          return (
            <span key={year} className="min-w-0 truncate" style={{ flexGrow: months.length, flexBasis: 0 }}>
              {formatDateRangeMonths(months[0]!.key, months[months.length - 1]!.key)}
            </span>
          )
        })}
      </div>
    </GlassSurface>
  )
}

/** "May – Dec 2025", "Jan – Sep 2026". */
function formatDateRangeMonths(fromKey: string, toKey: string): string {
  const from = formatDate(`${fromKey}-01`, { precision: 'month', year: 'never' })
  const to = formatDate(`${toKey}-01`, { precision: 'month', year: 'always' })
  return fromKey === toKey ? to : `${from} – ${to}`
}

function Bests({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const cells = [
    view.longestRun && { label: a.longestRun, value: `${formatKm(view.longestRun.km, 1)} ${t.units.km}`, date: view.longestRun.date },
    view.biggestWeek && { label: a.biggestWeek, value: `${formatKm(view.biggestWeek.km)} ${t.units.km}`, date: view.biggestWeek.weekStart },
  ].filter((cell): cell is { label: string; value: string; date: string } => !!cell)
  if (cells.length === 0) return null
  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-card-sm" data-testid="all-time-bests">
      <div className="grid grid-cols-2">
        {cells.map((cell, i) => (
          <div key={cell.label} className={cn('px-4 py-3.5', i === 1 && 'border-l border-border')}>
            <p className="text-caption uppercase tracking-[0.08em] text-muted-foreground">{cell.label}</p>
            <p className="mt-1.5 font-display text-title3 font-bold leading-none tabular-nums text-foreground">{cell.value}</p>
            <p className="mt-1.5 text-footnote text-muted-foreground">{formatDate(cell.date, { style: 'bare', year: 'always' })}</p>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}

export function AllTime({ view }: { view: AllTimeView }) {
  const a = t.allTime
  const partial = view.partialFirstYear
  return (
    <div className="space-y-3">
      <Totals view={view} />

      <GlassSurface variant="card" className="rounded-card-sm px-5 py-4" data-testid="all-time-years">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className={TITLE}>{a.byYear}</h2>
          <span className="text-footnote text-muted-foreground">{a.byYearUnits}</span>
        </div>
        <YearRows years={view.years} currentYear={view.currentYear} />
        {partial && (
          <p className="mt-3 text-footnote text-muted-foreground" data-testid="partial-year">
            {a.partialYear(
              partial.year,
              formatDate(`${partial.year}-${String(partial.startMonth).padStart(2, '0')}-01`, { precision: 'month', year: 'never', style: 'full' }),
              partial.months,
              partial.currentMonths,
              view.currentYear,
            )}
          </p>
        )}
      </GlassSurface>

      {view.monthly.length > 0 && <MonthlyBars view={view} />}
      <Bests view={view} />
    </div>
  )
}
