'use client'

import { cn } from '@/lib/utils'

/**
 * The switch (v4.17): 40 x 24 with an 18 px knob, the accent when on and
 * line-2 when off - off is a choice, never drawn as disabled.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'hit-44 relative h-6 w-10 shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-[var(--line-2)]',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[var(--shadow-toggle)] transition-transform',
          checked && 'translate-x-4'
        )}
      />
    </button>
  )
}
