'use client'

import { useId } from 'react'
import { X } from 'lucide-react'
import { t } from '@/i18n'
import { COMPLETE_PCT, type UnitCoverage } from '@/domain/explore/types'
import { formatDate, formatDistance, formatNumber, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { SHEET_CONTROL, Sheet } from '@/components/ui/Sheet'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { QUARTIER_SHEET_TEST_ID } from './quartierCamera'

const NO_VALUE = '—'
/** Less than this run in a quartier rounds to "0.0 km": a dash says it better. */
const MIN_KM_RUN = 0.05
/** A step down on the narrowest phones, so "10.9 km" stays on one line in a third of a 320 pt sheet. */
const STAT_VALUE_STYLE = { fontSize: 'clamp(22px, 6.875vw, 24px)', lineHeight: '30px' } as const

/** From an earlier year, the month and the year ("Aug 2025"): "Aug 14, 2025" breaks in two in a third of the sheet. */
export function lastRunLabel(date: string, now: Date = new Date()): string {
  return date.slice(0, 4) === String(now.getFullYear())
    ? formatDate(date, { style: 'bare', year: 'never', now })
    : formatDate(date, { style: 'bare', precision: 'month', year: 'always', now })
}

export function QuartierSheet({
  unit,
  completeSince = null,
  onClose,
  onPlanRun,
}: {
  unit: UnitCoverage
  /** The day it passed 90 %; shown only while this view counts it complete too. */
  completeSince?: string | null
  onClose: () => void
  onPlanRun?: (unitId: string) => void
}) {
  const titleId = useId()
  const s = t.pages.map.districts.sheet
  // The number and its unit never part (a no-break space).
  const km = (value: number) => `${formatDistance(value)}\u00a0${t.units.km}`
  const stats = [
    { label: s.runHere, value: unit.kmRun >= MIN_KM_RUN ? km(unit.kmRun) : NO_VALUE },
    { label: s.lastRun, value: unit.lastRunDate ? lastRunLabel(unit.lastRunDate) : NO_VALUE },
    { label: s.fromHome, value: unit.distanceKm != null ? km(unit.distanceKm) : NO_VALUE },
  ]
  return (
    <Sheet
      onClose={onClose}
      showClose={false}
      titleId={titleId}
      testId={QUARTIER_SHEET_TEST_ID}
      footer={
        onPlanRun ? (
          <Button size="lg" className="w-full" onClick={() => onPlanRun(unit.id)}>
            {s.planRunHere}
          </Button>
        ) : undefined
      }
    >
      {(close) => (
        // 4 pt down the sheet's scroller: room for the close button's focus ring, which the scroller's top edge cuts.
        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <h2 id={titleId} className="text-title-1 text-foreground text-pretty [overflow-wrap:anywhere]">
                {unit.name}
              </h2>
              <p className="text-subhead leading-5 text-muted-foreground">{unit.kind === 'commune' ? s.commune : s.quartierOf(unit.commune)}</p>
            </div>
            <button type="button" onClick={close} aria-label={t.common.close} className={cn(SHEET_CONTROL, 'w-11 text-foreground')}>
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-headline text-foreground">{s.explored(formatPercent(unit.pct))}</span>
              <span className="text-[14px] text-muted-foreground tabular-nums">{s.cells(unit.visited, unit.total, (n) => formatNumber(n, 0))}</span>
            </div>
            {/* Hidden from screen readers: the line above says both. */}
            <div aria-hidden="true" className="relative h-2 rounded-full bg-[var(--fill-3)]">
              <div
                data-testid="quartier-progress"
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${Math.min(100, Math.max(0, unit.pct))}%` }}
              />
              <div
                data-testid="quartier-complete-tick"
                className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground/40"
                style={{ left: `${COMPLETE_PCT}%` }}
              />
            </div>
            <p className="text-right text-footnote leading-4 text-muted-foreground" data-testid="quartier-complete-note">
              {completeSince && unit.pct >= COMPLETE_PCT ? s.completeSince(formatDate(completeSince, { style: 'bare' })) : s.completeAt(formatPercent(COMPLETE_PCT))}
            </p>
          </div>

          {/* 8 pt between the columns, not the grid's 16. */}
          <StatGrid columns={3} className="gap-2">
            {stats.map((stat) => (
              <Stat key={stat.label} labelPosition="bottom" label={stat.label} value={stat.value} valueStyle={STAT_VALUE_STYLE} />
            ))}
          </StatGrid>
        </div>
      )}
    </Sheet>
  )
}
