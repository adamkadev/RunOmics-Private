'use client'

import { useState } from 'react'
import { ChevronDown, ArrowRight, ArrowDown, Check, Minus } from 'lucide-react'
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

// Clamped to a visible minimum so a near-zero month still renders a sliver.
function barHeightPercent(mg: MonthGoal): number {
  const pct = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
  return Math.max(pct, 6)
}

export function MonthlyVolumeChart({ monthlyGoals }: { monthlyGoals: MonthGoal[] }) {
  const [expanded, setExpanded] = useState(false)
  const elapsedMonths = monthlyGoals.filter((mg) => mg.status !== 'pending')
  if (elapsedMonths.length === 0) return null

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-6 w-full items-center justify-between gap-2"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t.goals.monthlyVolume.title}
        </h2>
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
        <GlassSurface variant="card" className="flex h-24 items-end gap-2 rounded-card-sm p-4">
          {elapsedMonths.map((mg) => (
            <div
              key={mg.month}
              className="w-3 rounded-sm transition-all"
              title={`${monthLabel(mg.month)}: ${mg.actualKm} / ${mg.targetKm} km`}
              style={{
                height: `${barHeightPercent(mg)}%`,
                background: mg.status === 'behind' ? 'var(--color-missed)' : 'var(--accent)',
              }}
            />
          ))}
        </GlassSurface>
      )}
    </section>
  )
}
