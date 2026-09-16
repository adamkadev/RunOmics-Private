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

export function MonthlyVolumeChart({ monthlyGoals, year }: { monthlyGoals: MonthGoal[]; year: number }) {
  const [expanded, setExpanded] = useState(false)
  const elapsedMonths = monthlyGoals.filter((mg) => mg.status !== 'pending')
  const lastMonth = elapsedMonths[elapsedMonths.length - 1]
  if (!lastMonth) return null

  const scaleMax = volumePlotMaxKm(elapsedMonths)
  const current = inProgressMonth(elapsedMonths, year)
  const ruleMonth = current ?? lastMonth

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
            const progress = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
            const { Icon: StatusIcon, className: statusClassName } = STATUS_ICON[mg.status]
            const tint = MONTH_CELL_TINT[mg.status]
            return (
              <GlassSurface
                key={mg.month}
                variant="card"
                className={cn('rounded-card-sm p-5', tint.dashed && 'border-dashed')}
                style={tint.bg ? { background: tint.bg, borderColor: tint.border } : undefined}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-subtle">{monthLabel(mg.month)}</span>
                  <StatusIcon
                    size={12}
                    strokeWidth={3}
                    className={statusClassName}
                    aria-label={t.goals.monthlyVolume.status[mg.status]}
                  />
                </div>
                <p className="mt-1.5 text-xs font-medium text-foreground">
                  <AnimatedValue value={Math.round(mg.actualKm)} /> / {Math.round(mg.targetKm)}
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: tint.bar }}
                  />
                </div>
              </GlassSurface>
            )
          })}
        </div>
      ) : (
        <GlassSurface variant="card" className="rounded-card-sm p-4">
          <div className="flex h-20 items-stretch gap-2">
            {elapsedMonths.map((mg) => {
              const bar = MONTH_CELL_TINT[mg.status].bar
              const isCurrent = current?.month === mg.month
              return (
                <div key={mg.month} className="relative flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-sm transition-all"
                    title={`${monthLabel(mg.month)}: ${t.goals.monthlyVolume.km(Math.round(mg.actualKm), Math.round(mg.targetKm))} ${t.units.km}`}
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

          <div className="mt-1.5 flex gap-2">
            {elapsedMonths.map((mg) => (
              <span
                key={mg.month}
                className={cn(
                  'flex-1 text-center text-micro font-medium',
                  current?.month === mg.month ? 'text-foreground' : 'text-subtle',
                )}
              >
                {monthLabel(mg.month).slice(0, 1)}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-micro">
            <span className="flex items-center gap-1.5 text-subtle">
              <span
                aria-hidden
                className="w-4 shrink-0 border-t border-dashed"
                style={{ borderColor: TARGET_RULE_COLOR }}
              />
              {t.goals.monthlyVolume.targetRule(String(Math.round(ruleMonth.targetKm)))}
            </span>
            {current && (
              <span className={cn('font-semibold', STATUS_ICON[current.status].className)}>
                {monthLabel(current.month)} · {t.goals.monthlyVolume.status[current.status]}
              </span>
            )}
          </div>
        </GlassSurface>
      )}
    </section>
  )
}
