'use client'

import { Toggle } from '@/components/ui/Toggle'
import { setGlow, useGlow, useReducedTransparency } from '@/lib/glow'
import { t } from '@/i18n'

/**
 * Settings › Appearance › Background glow (round 2, F2): one switch for
 * both themes, its hint under the title. With iOS's Reduce Transparency or
 * Increase Contrast on, the glow is off whatever it says; the switch keeps
 * the saved value and the hint says so.
 */
export function GlowRow({ className }: { className?: string }) {
  const a = t.settings.appearance
  const on = useGlow()
  const reduced = useReducedTransparency()

  return (
    <div className={className} data-testid="glow-row">
      <div className="min-w-0">
        <p className="text-[17px] tracking-[-0.027rem] text-foreground">{a.glowLabel}</p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground" data-testid="glow-hint">
          {a.glowHint}
          {reduced && a.reducedTransparencyNote}
        </p>
      </div>
      <Toggle checked={on} onChange={setGlow} label={a.glowLabel} />
    </div>
  )
}
