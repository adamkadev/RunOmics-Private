'use client'

import { cn } from '@/lib/utils'
import { SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { setLightStyle, useLightStyle, useReducedTransparency, type LightStyle } from '@/lib/lightStyle'
import { t } from '@/i18n'

const OPTIONS: readonly LightStyle[] = ['aura', 'plain']

/**
 * Settings › Appearance › Light background (Liquid Glass v3, G14): the
 * title, its hint under it, and Aura | Plain as the Theme row's switch. It
 * stays enabled in dark mode - the choice is kept for light - and with iOS's
 * Reduce Transparency or Increase Contrast on, the page renders Plain
 * whatever it says; the hint says so.
 */
export function LightStyleRow({ className }: { className?: string }) {
  const a = t.settings.appearance
  const style = useLightStyle()
  const reduced = useReducedTransparency()

  return (
    <div className={className} data-testid="light-style-row">
      <div className="min-w-0">
        <p className="text-[17px] tracking-[-0.027rem] text-foreground">{a.lightStyleLabel}</p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground" data-testid="light-style-hint">
          {style === 'aura' ? a.auraHint : a.plainHint}
          {reduced && a.reducedTransparencyNote}
        </p>
      </div>
      <div className={SEGMENTED_TRACK_CLASS} role="group" aria-label={a.lightStyleLabel}>
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLightStyle(option)}
            aria-pressed={style === option}
            className={cn('hit-44 h-[26px] px-3 text-[13px] transition-colors', style === option ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS)}
          >
            {a[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
