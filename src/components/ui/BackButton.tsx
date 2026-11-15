'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useNavigationOrigin } from '@/components/layout/NavigationHistory'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  fallbackHref?: string
  className?: string
  variant?: 'link' | 'round'
  /** Other parents the page opens from: when the page just left is one of them, back returns to it. */
  alsoFrom?: readonly { href: string; label: string }[]
}

/**
 * Goes to the page's parent, not the page before; it steps back in history
 * only when the parent is the page just left, which keeps its scroll and
 * filters. `data-bar-back` lets the compact title bar's chevron press it.
 */
export function BackButton({ label, fallbackHref = '/', className, variant = 'link', alsoFrom = [] }: Props) {
  const router = useRouter()
  const origin = useNavigationOrigin()
  const left = origin?.isImmediate ? origin.path.split('?')[0] : null
  const other = alsoFrom.find((parent) => parent.href === left)

  return (
    <button
      type="button"
      data-bar-back
      onClick={() => {
        if (left === fallbackHref || other) router.back()
        else router.push(fallbackHref)
      }}
      aria-label={other?.label ?? label}
      className={glassClass(variant === 'round' ? 'clear' : 'bar', cn(GLASS_CIRCLE, className))}
    >
      <GlassLayers />
      <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
}
