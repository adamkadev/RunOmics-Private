'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, ArrowDown, Check, Minus } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { monthLabel } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { GOAL_PACE_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const STATUS_ICON: Record<MonthGoal['status'], { Icon: typeof Check; className: string }> = {
  ahead:    { Icon: Check,       className: STATUS.success.text },
  on_track: { Icon: ArrowRight,  className: STATUS.progress.text },
  // Amber, matching GOAL_PACE_COLORS.behind: a missed volume target is caution,
  // not the red severity the app reserves for injury risk.
  behind:   { Icon: ArrowDown,   className: STATUS.warning.text },
  pending:  { Icon: Minus,       className: 'text-subtle/40' },
}

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
  const [expanded, setExpanded] = useState(false)
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
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-6 w-full items-center justify-between gap-2"
      >
        <SectionDivider as="h2">
          {t.goals.monthlyVolume.title}
        </SectionDivider>
        <span className="flex items-center gap-1 text-xs font-medium text-accent-text">
          {expanded ? t.goals.monthlyVolume.collapse : t.goals.monthlyVolume.expand}
          <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      {expanded ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {monthlyGoals.map((mg) => {
            const denominator = mg.progress ? mg.progress.proRataTargetKm : mg.targetKm
            const progress = denominator > 0 ? Math.min((mg.actualKm / denominator) * 100, 100) : 0
            const tint = monthTint(mg)
            const statusIcon = mg.progress ? null : STATUS_ICON[mg.status]
            return (
              <GlassSurface
                key={mg.month}
                variant="card"
                className={cn('rounded-card-sm p-5', tint.dashed && 'border-dashed')}
                style={tint.bg ? { background: tint.bg, borderColor: tint.border } : undefined}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-subtle">{monthLabel(mg.month)}</span>
                  {/* The running month gets no status mark at all, rather than
                      sharing pending's dash - the caption below already says
                      it's in progress, and a shared glyph read as one more
                      "hasn't happened" month next to three real ones. */}
                  {statusIcon && (
                    <statusIcon.Icon
                      size={12}
                      strokeWidth={3}
                      className={statusIcon.className}
                      aria-label={t.goals.monthlyVolume.status[mg.status]}
                    />
                  )}
                </div>
                <p className="mt-1.5 text-xs font-medium text-foreground">
                  <AnimatedValue value={Math.round(mg.actualKm)} /> /{' '}
                  {Math.round(mg.progress ? mg.progress.proRataTargetKm : mg.targetKm)}
                </p>
                {mg.progress && (
                  <p className="mt-0.5 truncate text-micro text-subtle">
                    {t.goals.monthlyVolume.proRataCaption(mg.progress.daysElapsed)}
                  </p>
                )}
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      // Neutral, not tint.bar's grey-on-grey dashed rule colour:
                      // this much of the month is real, covered ground - not yet
                      // a verdict either way, so it takes its own solid ink.
                      background: mg.progress ? 'var(--subtle)' : tint.bar,
                    }}
                  />
                  {mg.progress && (
                    // Only the days still ahead are provisional, so the dash
                    // sits on the remaining track, never over the solid fill.
                    <div
                      className="absolute inset-y-0 rounded-full border border-dashed"
                      style={{ left: `${progress}%`, right: 0, borderColor: tint.bar }}
                    />
                  )}
                </div>
              </GlassSurface>
            )
          })}
        </div>
      ) : (
        <GlassSurface variant="card" className="rounded-card-sm p-4">
          <div className="relative flex h-20 items-stretch gap-2 pl-6">
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 -translate-y-1/2 text-[10px] font-medium text-subtle"
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
                  'flex-1 truncate text-center text-micro font-medium',
                  current?.month === mg.month ? 'text-foreground' : 'text-subtle',
                )}
              >
                {elapsedMonths.length > 6 && i % 2 === 1 ? '' : monthLabel(mg.month)}
              </span>
            ))}
          </div>

          {/* Three fills and a rule, so a reader can tell which bar is which
              without tapping into the expanded grid. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-subtle">
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
      )}
    </section>
  )
}
