import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-foreground hover:brightness-105 active:scale-[0.96]',
  secondary:
    'border border-foreground/[0.16] bg-foreground/10 text-foreground hover:bg-foreground/[0.14] active:scale-[0.96]',
  ghost:
    'bg-transparent text-foreground/80 hover:text-foreground active:opacity-60',
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
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-[18px] py-2.5',
        'text-sm font-semibold transition-[transform,background-color,opacity] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASS[variant],
        className
      )}
      {...rest}
    />
  )
})
