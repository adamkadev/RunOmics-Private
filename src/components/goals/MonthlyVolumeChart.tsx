'use client'

import { ChevronRight } from 'lucide-react'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { monthLabel, monthName } from '@/lib/formatters'
import { GOAL_PACE_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const MONTH_CELL_TINT: Record<MonthGoal['status'], { bg: string; border: string; bar: string; dashed?: boolean }> = {
  ahead:    GOAL_PACE_COLORS.ahead,
  on_track: GOAL_PACE_COLORS.onTrack,
  behind:   GOAL_PACE_COLORS.behind,
  pending:  { ...GOAL_PACE_COLORS.pending, dashed: true },
}

/** Neutral ink, so the rule reads over both the card ground and a coloured bar. */
const TARGET_RULE_COLOR = 'color-mix(in srgb, var(--foreground) 40%, transparent)'

const IN_PROGRESS_TINT = { bg: '', border: TARGET_RULE_COLOR, bar: TARGET_RULE_COLOR, dashed: true }

function monthTint(mg: MonthGoal) {
  return mg.progress ? IN_PROGRESS_TINT : MONTH_CELL_TINT[mg.status]
}

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
        <GlassSurface variant="card" className="flex min-h-14 items-center justify-between gap-3 rounded-card-sm px-4 py-2.5">
          <span className="min-w-0">
            <span className="block text-body font-semibold text-foreground">{t.goals.monthlyVolume.title}</span>
            <span className="block truncate text-footnote text-muted-foreground">
              {t.goals.monthlyVolume.subtitle(monthName(elapsedMonths[0]!.month), monthName(lastMonth.month))}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-subtle transition-transform group-open:rotate-90" aria-hidden="true" />
        </GlassSurface>
      </summary>
      <div className="pt-3">
        <GlassSurface variant="card" className="rounded-card-sm p-4">
          <div className="relative flex h-20 items-stretch gap-2 pl-6">
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 -translate-y-1/2 text-caption font-medium text-subtle"
              style={{ bottom: `${Math.min((typicalTargetKm / scaleMax) * 100, 100)}%` }}
            >
              {typicalTargetKm}
            </span>
            {elapsedMonths.map((mg) => {
              const bar = monthTint(mg).bar
              const isCurrent = current?.month === mg.month
              return (
                <div key={mg.month} className="relative flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-sm transition-all"
                    title={`${monthLabel(mg.month)}: ${t.goals.monthlyVolume.km(
                      Math.round(mg.actualKm),
                      Math.round(mg.progress ? mg.progress.proRataTargetKm : mg.targetKm),
                    )} ${t.units.km}`}
                    style={{
                      height: `${(mg.actualKm / scaleMax) * 100}%`,
                      minHeight: mg.actualKm > 0 ? 2 : 0,
                      // The month in progress is outlined, not filled: its bar is
                      // short because the month is unfinished, not because it failed.
                      background: isCurrent ? `color-mix(in srgb, ${bar} 14%, transparent)` : bar,
                      border: isCurrent ? `1px solid ${bar}` : undefined,
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
                  'flex-1 truncate text-center text-caption font-medium',
                  current?.month === mg.month ? 'text-foreground' : 'text-subtle',
                )}
              >
                {elapsedMonths.length > 6 && i % 2 === 1 ? '' : monthLabel(mg.month)}
              </span>
            ))}
          </div>

          {/* Three fills and a rule, so a reader can tell which bar is which
              without tapping into the expanded grid. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-subtle">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-4 shrink-0 border-t border-dashed"
                style={{ borderColor: TARGET_RULE_COLOR }}
              />
              {t.goals.monthlyVolume.targetRule}
            </span>
            {(['ahead', 'behind'] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: MONTH_CELL_TINT[status].bar }}
                />
                {t.goals.monthlyVolume.status[status]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px] border border-dashed"
                style={{ borderColor: TARGET_RULE_COLOR }}
              />
              {t.goals.monthlyVolume.inProgress}
            </span>
            {current?.progress && (
              <span className="ml-auto text-subtle">
                {t.goals.monthlyVolume.daysIn(monthLabel(current.month), current.progress.daysElapsed)} ·{' '}
                {t.goals.monthlyVolume.proRata(
                  Math.round(current.actualKm),
                  Math.round(current.progress.proRataTargetKm),
                )}
              </span>
            )}
          </div>
        </GlassSurface>
      </div>
    </details>
  )
}
