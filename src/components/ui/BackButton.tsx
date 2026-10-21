'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'

interface Props {
  /** The parent page's name: what the link says, wherever the reader came from. */
  label: string
  /** The parent page. */
  fallbackHref?: string
  className?: string
  /** `round`: the circle over a map hero, in clear glass (Liquid Glass v3, G11). */
  variant?: 'link' | 'round'
}

/**
 * The link to a page's parent (v4.17): an activity to Activities, a detail
 * under Progress to Progress. It names the parent, not the page before - a
 * run opened from Today still reads "‹ Activities". The mark is a chevron,
 * never an arrow (App Fixes, rule 01). Stepping back in history
 * when the parent is the page just left keeps its scroll and its filters.
 *
 * Once it scrolls away, the compact title bar's chevron presses it
 * (`data-bar-back`), so the way back stays in reach (design review, Oct 2026).
 *
 * A 44 pt glass circle with the chevron alone, at rest as in the compact bar
 * (Liquid Glass v2, section 11): the parent's name is its accessible name,
 * no longer a text label beside it. Liquid Glass v3's object (G1): regular
 * glass on a page, the large title 4 pt under it; clear glass over a map.
 */
export function BackButton({ label, fallbackHref = '/', className, variant = 'link' }: Props) {
  const router = useRouter()
  const origin = useNavigationOrigin()

  return (
    <button
      type="button"
      data-bar-back
      onClick={() => {
        if (origin?.isImmediate && origin.path.split('?')[0] === fallbackHref) router.back()
        else router.push(fallbackHref)
      }}
      aria-label={label}
      className={glassClass(variant === 'round' ? 'clear' : 'regular', cn(GLASS_CIRCLE, variant === 'link' && 'mb-1', className))}
    >
      <GlassLayers />
      <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
}
