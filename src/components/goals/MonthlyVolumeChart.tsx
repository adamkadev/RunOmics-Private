'use client'

import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { formatKm, monthName } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { monthInitials } from './monthInitials'

/** The Analytics weekly bars' rule. */
const MONTH_BAR: Record<'hit' | 'short', string> = {
  hit: 'var(--accent)',
  short: 'color-mix(in srgb, var(--accent) 40%, transparent)',
}

/** Neutral ink, so the rule reads over both the card ground and a bar. */
const TARGET_RULE_COLOR = 'var(--muted-foreground)'

const pct = (km: number, max: number) => `${Math.min((km / max) * 100, 100)}%`

/** One scale for every bar: normalised to its own target, a month that beat it would look like one that met it. */
export function volumePlotMaxKm(months: MonthGoal[]): number {
  const peak = months.reduce((max, mg) => Math.max(max, mg.actualKm, mg.targetKm), 0)
  return peak > 0 ? peak * 1.08 : 1
}

export function inProgressMonth(months: MonthGoal[], year: number, now = new Date()): MonthGoal | null {
  if (year !== now.getFullYear()) return null
  return months.find((mg) => mg.month === now.getMonth() + 1) ?? null
}

export function MonthlyVolumeChart({ monthlyGoals, year, today }: { monthlyGoals: MonthGoal[]; year: number; today: string }) {
  const elapsed = monthlyGoals.filter((mg) => mg.status !== 'pending')
  if (elapsed.length === 0) return null

  const m = t.goals.monthlyVolume
  const scaleMax = volumePlotMaxKm(elapsed)
  const current = inProgressMonth(elapsed, year, new Date(`${today}T00:00:00`))
  const targetKm = elapsed[0]!.targetKm
  // One line only while the months agree; otherwise each bar is ticked.
  const oneTarget = elapsed.every((mg) => mg.targetKm === targetKm)
  const initials = monthInitials()
  const byMonth = new Map(monthlyGoals.map((mg) => [mg.month, mg]))

  return (
    <section className={cardClass({ className: 'flex flex-col gap-2.5' })} data-testid="monthly-volume">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-headline text-foreground">{m.title}</h2>
        {targetKm > 0 && (
          <span className="text-xs text-muted-foreground">{oneTarget ? m.target(formatKm(targetKm)) : m.targetFromPlan}</span>
        )}
      </div>

      <div className="relative grid h-20 grid-cols-12 gap-1">
        {oneTarget && targetKm > 0 && (
          <span
            aria-hidden
            data-testid="target-rule"
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
            style={{ bottom: pct(targetKm, scaleMax), borderColor: TARGET_RULE_COLOR }}
          />
        )}
        {initials.map((_, i) => {
          const mg = byMonth.get(i + 1)
          if (!mg || mg.status === 'pending') return <div key={i} />
          const title = `${monthName(mg.month)}: ${m.km(formatKm(mg.actualKm), formatKm(mg.targetKm))} ${t.units.km}`
          if (current?.month === mg.month) {
            // A dashed outline of the target: the month is short because it is unfinished, not because it failed.
            const outline = Math.max(mg.targetKm, mg.actualKm)
            return (
              <div key={i} className="relative">
                <div
                  className="absolute inset-x-0 bottom-0 box-border rounded-[4px] border-[1.5px] border-dashed border-accent"
                  style={{ height: pct(outline, scaleMax) }}
                  data-testid="running-month"
                  title={title}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[3px] bg-accent"
                    style={{ height: `${outline > 0 ? (mg.actualKm / outline) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )
          }
          const hit = mg.actualKm >= mg.targetKm
          return (
            <div key={i} className="relative">
              {!oneTarget && mg.targetKm > 0 && (
                <span
                  aria-hidden
                  data-testid="month-target-tick"
                  className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
                  style={{ bottom: pct(mg.targetKm, scaleMax), borderColor: TARGET_RULE_COLOR }}
                />
              )}
              <div
                className="absolute inset-x-0 bottom-0 rounded-[4px]"
                title={title}
                data-status={hit ? 'hit' : 'short'}
                style={{ height: pct(mg.actualKm, scaleMax), minHeight: mg.actualKm > 0 ? 2 : 0, background: MONTH_BAR[hit ? 'hit' : 'short'] }}
              />
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-1" aria-hidden>
        {initials.map((initial, i) => (
          <span
            key={i}
            className={cn('text-center text-[11px]', current?.month === i + 1 ? 'text-accent-text' : 'text-muted-foreground')}
          >
            {initial}
          </span>
        ))}
      </div>

      <Legend>
        <LegendItem swatch="square" color={MONTH_BAR.hit}>{m.hit}</LegendItem>
        <LegendItem swatch="square" color={MONTH_BAR.short}>{m.short}</LegendItem>
        {current && current.status !== 'pending' && (
          <LegendItem swatch="dashRing" color="var(--accent)">
            <span data-testid="running-legend">{m.running(monthName(current.month), formatKm(current.actualKm), m.pace[current.status])}</span>
          </LegendItem>
        )}
      </Legend>
    </section>
  )
}
