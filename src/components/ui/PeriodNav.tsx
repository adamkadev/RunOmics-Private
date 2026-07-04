'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface Props {
  label: ReactNode
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  prevLabel?: string
  nextLabel?: string
  children?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

// Visually 24px to stay compact under a title, but the hit area is expanded
// to the HIG 44px minimum via an invisible ::after overlay.
const SM_BTN =
  'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-foreground/[0.12] bg-foreground/[0.08] text-foreground/65 transition-colors after:absolute after:-inset-2.5 after:content-[""] hover:bg-foreground/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

export function PeriodNav({
  label,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  children,
  size = 'md',
  className,
}: Props) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {size === 'md' ? (
        <Button
          variant="secondary"
          aria-label={prevLabel}
          onClick={onPrev}
          disabled={prevDisabled}
          className="h-11 w-11 shrink-0 rounded-md p-0"
        >
          <ChevronLeft size={16} />
        </Button>
      ) : (
        <button type="button" aria-label={prevLabel} onClick={onPrev} disabled={prevDisabled} className={SM_BTN}>
          <ChevronLeft size={12} />
        </button>
      )}

      <div className="min-w-0 overflow-hidden text-center">
        <div className="flex items-center justify-center">{label}</div>
        {children && (
          <div className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {children}
          </div>
        )}
      </div>

      {size === 'md' ? (
        <Button
          variant="secondary"
          aria-label={nextLabel}
          onClick={onNext}
          disabled={nextDisabled}
          className="h-11 w-11 shrink-0 rounded-md p-0"
        >
          <ChevronRight size={16} />
        </Button>
      ) : (
        <button type="button" aria-label={nextLabel} onClick={onNext} disabled={nextDisabled} className={SM_BTN}>
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}
