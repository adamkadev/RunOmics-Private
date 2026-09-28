'use client'

import { ChevronRight } from 'lucide-react'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { cardClass } from '@/components/ui/Card'
import { Legend, LegendItem } from '@/components/ui/Legend'
import { monthLabel, monthName } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * A month's volume is the athlete's own data (v4.17): the accent where it
 * met its target, the accent at 40% where it fell short - the Analytics
 * weekly bars' rule - and the month still running outlined.
 */
const MONTH_BAR: Record<MonthGoal['status'], string> = {
  ahead: 'var(--accent)',
  on_track: 'var(--accent)',
  behind: 'color-mix(in srgb, var(--accent) 40%, transparent)',
  pending: 'var(--surface-2)',
}

/** Neutral ink, so the rule reads over both the card ground and a bar. */
const TARGET_RULE_COLOR = 'var(--muted-foreground)'

/**
 * One vertical scale for every bar in the collapsed chart, so heights are
 * comparable month to month. Normalising each bar to its own target instead
 * makes a month that beat its target indistinguishable from one that met it.
 */
export function volumePlotMaxKm(months: MonthGoal[]): number {
  const peak = months.reduce((max, mg) => Math.max(max, mg.actualKm, mg.targetKm), 0)
  return peak > 0 ? peak * 1.08 : 1
}

/** The month still being run, or null when the chart shows a year that is over. */
export function inProgressMonth(months: MonthGoal[], year: number, now = new Date()): MonthGoal | null {
  if (year !== now.getFullYear()) return null
  return months.find((mg) => mg.month === now.getMonth() + 1) ?? null
}

export function MonthlyVolumeChart({ monthlyGoals, year, today }: { monthlyGoals: MonthGoal[]; year: number; today: string }) {
  const elapsedMonths = monthlyGoals.filter((mg) => mg.status !== 'pending')
  const lastMonth = elapsedMonths[elapsedMonths.length - 1]
  if (!lastMonth) return null

  const scaleMax = volumePlotMaxKm(elapsedMonths)
  const current = inProgressMonth(elapsedMonths, year, new Date(`${today}T00:00:00`))
  // The dashed rule per bar already varies with days-in-month, but that leaves
  // every month's target unlabelled - there's no way to tell what a bar missed
  // by. The rules cluster tightly enough that one axis figure for their
  // average height reads as "the" monthly target without cluttering each bar.
  const typicalTargetKm = Math.round(
    elapsedMonths.reduce((sum, mg) => sum + mg.targetKm, 0) / elapsedMonths.length,
  )

  return (
    // A row, as in R7d, that opens onto the chart: the inline chart with its
    // Expand toggle pushed the rest of the season below it.
    <details className="group" data-testid="monthly-volume">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className={cardClass({ className: 'flex min-h-14 items-center justify-between gap-3 py-3.5 transition-colors hover:border-[var(--line-2)]' })}>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-foreground">{t.goals.monthlyVolume.title}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {t.goals.monthlyVolume.subtitle(monthName(elapsedMonths[0]!.month), monthName(lastMonth.month))}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
        </div>
      </summary>
      <div className="pt-3.5">
        <div className={cardClass()}>
          <div className="relative flex h-20 items-stretch gap-2 pl-6">
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 -translate-y-1/2 text-[11px] text-muted-foreground"
              style={{ bottom: `${Math.min((typicalTargetKm / scaleMax) * 100, 100)}%` }}
            >
              {typicalTargetKm}
            </span>
            {elapsedMonths.map((mg) => {
              const isCurrent = current?.month === mg.month
              const bar = isCurrent ? 'var(--accent)' : MONTH_BAR[mg.status]
              return (
                <div key={mg.month} className="relative flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[5px_5px_2px_2px] transition-all"
                    title={`${monthLabel(mg.month)}: ${t.goals.monthlyVolume.km(
                      Math.round(mg.actualKm),
                      Math.round(mg.progress ? mg.progress.proRataTargetKm : mg.targetKm),
                    )} ${t.units.km}`}
                    style={{
                      height: `${(mg.actualKm / scaleMax) * 100}%`,
                      minHeight: mg.actualKm > 0 ? 2 : 0,
                      // The month in progress is dashed, not filled: its bar is
                      // short because the month is unfinished, not because it failed.
                      background: isCurrent ? `color-mix(in srgb, ${bar} 14%, transparent)` : bar,
                      border: isCurrent ? `1px dashed ${bar}` : undefined,
                    }}
                  />
                  {mg.targetKm > 0 && (
                    <span
                      aria-hidden
                      data-testid="target-rule"
                      className="absolute inset-x-0 border-t border-dashed"
                      style={{ bottom: `${(mg.targetKm / scaleMax) * 100}%`, borderColor: TARGET_RULE_COLOR }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-1.5 flex gap-2 pl-6">
            {elapsedMonths.map((mg, i) => (
              <span
                key={mg.month}
                className={cn(
                  // A month's three letters, centred on its bar and never cut to "MA…" (v4.17.2).
                  'flex-1 whitespace-nowrap text-center text-[11px]',
                  current?.month === mg.month ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {elapsedMonths.length > 6 && i % 2 === 1 ? '' : monthLabel(mg.month)}
              </span>
            ))}
          </div>

          {/* Two fills, the running month and the rule, so a reader can tell
              which bar is which without tapping into the expanded grid. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
            <Legend>
              <LegendItem swatch="dash" color={TARGET_RULE_COLOR}>{t.goals.monthlyVolume.targetRule}</LegendItem>
              {(['ahead', 'behind'] as const).map((status) => (
                <LegendItem key={status} swatch="square" color={MONTH_BAR[status]}>{t.goals.monthlyVolume.status[status]}</LegendItem>
              ))}
              <LegendItem swatch="dashRing" color="var(--accent)">{t.goals.monthlyVolume.inProgress}</LegendItem>
            </Legend>
            {current?.progress && (
              <span className="ml-auto">
                {t.goals.monthlyVolume.daysIn(monthLabel(current.month), current.progress.daysElapsed)} ·{' '}
                {t.goals.monthlyVolume.proRata(
                  Math.round(current.actualKm),
                  Math.round(current.progress.proRataTargetKm),
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </details>
  )
}
