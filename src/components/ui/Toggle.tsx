'use client'

import { cn } from '@/lib/utils'

/**
 * The switch: iOS's 51 x 31 with a 27 px knob (round 2, F2), the accent
 * when on and line-2 when off - off is a choice, never drawn as disabled.
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
        'hit-44 relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-[var(--band)]',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-[var(--shadow-toggle)] transition-transform',
          checked && 'translate-x-5'
        )}
      />
    </button>
  )
}
