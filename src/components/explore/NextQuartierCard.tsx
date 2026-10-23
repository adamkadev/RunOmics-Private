'use client'

import type { Ref } from 'react'
import { t } from '@/i18n'
import type { UnitCoverage } from '@/domain/explore/types'
import { formatDistance, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Glass, GlassLayers, glassClass } from '@/components/ui/GlassSurface'

/**
 * The geometry of the card: the heat's fullscreen card's corner and side
 * insets, a step tighter top and bottom, so its three lines take that card's
 * height and the controls stacked above keep their place when the layer
 * changes.
 */
const BOX = 'flex items-center gap-3 rounded-[28px] py-[11px] pl-[18px] pr-3'

/**
 * The expanded Districts map's card (S1): the next quartier to explore,
 * how much of it is done and how far it is. One glass surface in the sheet
 * material, in the heat's fullscreen card's place. With a way to plan a run
 * there (`onPlanRun`) it holds that button; until then the whole card opens
 * the quartier's sheet - `ref` is that card's button, for focus to come back
 * to when the sheet closes.
 */
export function NextQuartierCard({
  ref,
  unit,
  onOpen,
  onPlanRun,
  className,
}: {
  ref?: Ref<HTMLButtonElement>
  unit: UnitCoverage
  onOpen: (unitId: string) => void
  onPlanRun?: (unitId: string) => void
  className?: string
}) {
  const d = t.pages.map.districts
  const distance = unit.distanceKm != null ? `${formatDistance(unit.distanceKm)} ${t.units.km}` : null
  const body = (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.1em] text-muted-foreground">{d.nextToExplore}</span>
      <span className="truncate text-[22px] font-bold leading-[25px] tracking-[-0.01em] text-foreground">{unit.name}</span>
      <span className="truncate text-[13px] leading-4 text-[var(--text-2)]">{d.nextMeta(formatPercent(unit.pct), distance)}</span>
    </span>
  )

  if (onPlanRun) {
    return (
      <Glass material="sheet" data-testid="next-quartier-card" className={cn(BOX, className)}>
        {body}
        <Button size="lg" className="shrink-0 px-5" onClick={() => onPlanRun(unit.id)}>
          {d.planRun}
        </Button>
      </Glass>
    )
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(unit.id)}
      aria-haspopup="dialog"
      data-testid="next-quartier-card"
      // The glass press, a breath of it: a card the width of the screen swelled by 6% ran off its sides.
      className={glassClass(
        'sheet',
        cn(BOX, 'w-full motion-safe:active:[transform:scale(1.02)] motion-reduce:active:[transform:none]', className),
      )}
    >
      <GlassLayers />
      {body}
    </button>
  )
}
