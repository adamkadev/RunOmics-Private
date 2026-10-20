'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { cn } from '@/lib/utils'

interface Props {
  /** The parent page's name: what the link says, wherever the reader came from. */
  label: string
  /** The parent page. */
  fallbackHref?: string
  className?: string
  /** `round`: a 40 pt circle with the arrow alone, floating over a map hero. */
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
      aria-label={variant === 'round' ? label : undefined}
      // A 44 pt target around the 22 pt line (design review, Oct 2026).
      className={cn(
        variant === 'round'
          ? 'map-round-button hit-44'
          : 'hit-44 mb-4 inline-flex items-center gap-1.5 text-subhead font-semibold text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ChevronLeft size={variant === 'round' ? 20 : 18} strokeWidth={2.2} aria-hidden={variant === 'round' || undefined} />
      {variant === 'link' && label}
    </button>
  )
}
