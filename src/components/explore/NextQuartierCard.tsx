'use client'

import type { Ref } from 'react'
import { t } from '@/i18n'
import type { UnitCoverage } from '@/domain/explore/types'
import { formatDistance, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Glass, GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { useFitsWhole } from './useFitsWhole'

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
 * the quartier's sheet. `ref` is the card's one control - the Plan a run
 * button, or the card itself - for focus to come back to when what it
 * opened closes.
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
  const pct = formatPercent(unit.pct)
  // "8% explored · 1.9 km from home" (S1) where it fits whole; beside the
  // button, with two digits or in French, "… · 1.9 km away" - never "from ho…".
  const { textRef: metaRef, whole: metaWhole } = useFitsWhole<HTMLSpanElement>(d.nextMeta(pct, distance))
  const body = (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.1em] text-muted-foreground">{d.nextToExplore}</span>
      <span className="truncate text-[22px] font-bold leading-[25px] tracking-[-0.01em] text-foreground">{unit.name}</span>
      <span ref={metaRef} data-testid="next-quartier-meta" className="truncate text-[13px] leading-4 text-[var(--text-2)]">
        {metaWhole ? d.nextMeta(pct, distance) : d.nextMetaShort(pct, distance)}
      </span>
    </span>
  )

  if (onPlanRun) {
    return (
      <Glass material="sheet" data-testid="next-quartier-card" className={cn(BOX, className)}>
        {body}
        {/* S1's button: 46 pt at 16 pt. */}
        <Button ref={ref} size="lg" className="h-[46px] shrink-0 px-4 text-[16px]" onClick={() => onPlanRun(unit.id)}>
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
