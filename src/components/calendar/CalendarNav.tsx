'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { t } from '@/i18n'

interface NavArrowProps {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled?: boolean
}

/** Single chevron button, meant to flank the day/month grid on either side. */
export function NavArrow({ direction, onClick, disabled }: NavArrowProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/[0.12] bg-foreground/[0.08] text-foreground/65 transition-colors hover:bg-foreground/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={14} />
    </button>
  )
}

export function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-subtle"
    >
      {t.calendar.today}
    </button>
  )
}
