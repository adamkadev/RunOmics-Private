import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'

/**
 * The v4.17 buttons: primary is the accent with its ink - the one place the
 * accent fills, for real actions (Sync now, Adjust plan); secondary is an
 * outline in line-2; a link is accent text at 500.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'h-9 rounded-[9px] px-3.5 bg-accent text-accent-foreground hover:brightness-105 active:scale-[0.96]',
  secondary:
    'h-9 rounded-[9px] px-3.5 border border-[var(--line-2)] bg-transparent text-foreground hover:bg-[var(--surface-2)] active:scale-[0.96]',
  ghost:
    'h-9 rounded-[9px] px-3.5 bg-transparent text-foreground/80 hover:text-foreground active:opacity-60',
  link:
    'font-medium! text-accent-text hover:opacity-80',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', type = 'button', className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5',
        'text-[13px] font-semibold transition-[transform,background-color,opacity] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASS[variant],
        className
      )}
      {...rest}
    />
  )
})
