'use client'

import type { CSSProperties } from 'react'
import { Layers2 } from 'lucide-react'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { GLASS_CIRCLE, GlassLayers, glassClass } from '@/components/ui/GlassSurface'

/** Only the fill token changes, so the glass stays glass. */
const ON_STYLE = {
  '--glass-fill': 'color-mix(in srgb, var(--accent) 24%, transparent)',
  boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--accent) 60%, transparent), var(--glass-drop)',
} as CSSProperties

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
      {/* Two tiers, as the design draws it (lucide's Layers has three). */}
      <Layers2 size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
