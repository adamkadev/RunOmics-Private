'use client'

import type { Ref } from 'react'
import { t } from '@/i18n'
import type { UnitCoverage } from '@/domain/explore/types'
import { formatDistance, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Glass, GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { useFitsWhole } from './useFitsWhole'

/** The heat card's insets, a step tighter top and bottom, so the controls stacked above keep their place when the layer changes. */
const BOX = 'flex items-center gap-3 rounded-[28px] py-[11px] pl-[18px] pr-3'

/** `ref` is the card's one control (the Plan a run button, or the card itself), for focus to come back to when what it opened closes. */
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
  // "8% explored · 1.9 km from home" where it fits whole, else "… · 1.9 km away": never "from ho…".
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
      // A breath of the glass press: a screen-wide card swelled by 6% runs off its sides.
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
