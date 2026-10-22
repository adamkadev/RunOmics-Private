'use client'

import type { CSSProperties } from 'react'
import { Layers2 } from 'lucide-react'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { GLASS_CIRCLE, GlassLayers, glassClass } from '@/components/ui/GlassSurface'

/**
 * The accent while Districts is on (V2/V4): the glass takes a quarter of the
 * accent, a 1.5 pt accent ring sits on its rim over the usual drop, and the
 * icon turns accent. Only the fill token changes, so the glass stays glass.
 */
const ON_STYLE = {
  '--glass-fill': 'color-mix(in srgb, var(--accent) 24%, transparent)',
  boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--accent) 60%, transparent), var(--glass-drop)',
} as CSSProperties

/**
 * Heat ↔ Districts (Explore): one 44 pt glass circle in the map's control
 * layer, bottom right - pressed while the Districts layer is on.
 */
export function LayersButton({ on, onToggle, className }: { on: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={t.pages.map.districts.layersButton}
      data-testid="layers-button"
      className={glassClass('regular', cn(GLASS_CIRCLE, on && 'text-accent-text', className))}
      style={on ? ON_STYLE : undefined}
    >
      <GlassLayers />
      {/* Two tiers, as V1-V4 draw it (lucide's Layers has three). */}
      <Layers2 size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
