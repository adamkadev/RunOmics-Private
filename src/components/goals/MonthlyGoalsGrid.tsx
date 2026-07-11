'use client'

import { useState } from 'react'
import { Calendar, ChevronDown, ArrowRight, ArrowDown, Check, Minus } from 'lucide-react'
import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { monthLabel } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// Icon-only status indicators: check green (ahead/done), arrow blue (on track), down amber (behind), dash gray (pending)
const STATUS_ICON: Record<MonthGoal['status'], { Icon: typeof Check; className: string }> = {
  ahead:    { Icon: Check,       className: STATUS.success.text },
  on_track: { Icon: ArrowRight,  className: STATUS.progress.text },
  behind:   { Icon: ArrowDown,   className: STATUS.warning.text },
  pending:  { Icon: Minus,       className: 'text-subtle/40' },
}

const MONTH_CELL_TINT: Record<MonthGoal['status'], { bg: string; border: string; bar: string; dashed?: boolean }> = {
  ahead:    { bg: 'rgba(16,185,129,0.06)',         border: 'rgba(16,185,129,0.25)',     bar: 'var(--accent)' },
  on_track: { bg: 'rgba(47,116,224,0.10)',         border: 'rgba(47,116,224,0.28)',     bar: '#7db8ff' },
  behind:   { bg: 'rgba(229,57,107,0.06)',         border: 'rgba(229,57,107,0.25)',     bar: '#e5396b' },
  pending:  { bg: '',                              border: '',                           bar: 'rgba(255,255,255,0.08)', dashed: true },
}

// Clamped to a visible minimum so pending/zero months still render a sliver in the collapsed strip.
function barHeightPercent(mg: MonthGoal): number {
  const pct = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
  return Math.max(pct, 6)
}

export function MonthlyGoalsGrid({ monthlyGoals }: { monthlyGoals: MonthGoal[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar size={16} className="text-accent-text" />
          {t.goals.monthlyGoal.title}
        </h2>
        <span className="flex items-center gap-1 text-xs font-medium text-accent-text">
          {expanded ? t.goals.monthlyGoal.collapse : t.goals.monthlyGoal.expand}
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
                    aria-label={t.goals.monthlyGoal.status[mg.status]}
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
        <GlassSurface variant="card" className="p-4">
          <div className="flex h-10 items-end gap-1.5">
            {monthlyGoals.map((mg) => (
              <div
                key={mg.month}
                className="flex-1 rounded-sm transition-all"
                style={{ height: `${barHeightPercent(mg)}%`, background: MONTH_CELL_TINT[mg.status].bar }}
              />
            ))}
          </div>
        </GlassSurface>
      )}
    </section>
  )
}
