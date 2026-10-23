'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { t } from '@/i18n'

const NAV_BUTTON =
  'hit-44 flex size-[30px] shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

/** Today's chip sits in the period's row, so the chart under it never moves as it comes and goes. */
export function PlanPeriodNav({
  label,
  onPrev,
  onNext,
  nextDisabled = false,
  onToday,
}: {
  label: ReactNode
  onPrev: () => void
  onNext: () => void
  nextDisabled?: boolean
  onToday?: (() => void) | null
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label={t.plan.prevPeriod} onClick={onPrev} className={NAV_BUTTON}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="flex min-w-0 items-center gap-1.5 text-[17px] font-semibold text-foreground">
        <span className="truncate">{label}</span>
        {onToday && (
          <button
            type="button"
            onClick={onToday}
            className="hit-44 shrink-0 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[13px] font-medium text-accent-text transition-colors hover:bg-[var(--line-2)]"
          >
            {t.plan.today}
          </button>
        )}
      </div>
      <button type="button" aria-label={t.plan.nextPeriod} onClick={onNext} disabled={nextDisabled} className={NAV_BUTTON}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
