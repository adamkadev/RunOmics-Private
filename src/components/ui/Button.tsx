import Link from 'next/link'
import { cn } from '@/lib/utils'
import { forwardRef, type ComponentProps } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md'

/**
 * The v4.17 buttons: primary is the accent with its ink - the one place the
 * accent fills, for real actions (Sync now, Adjust plan); secondary is an
 * outline in line-2; a link is accent text at 500.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'rounded-[9px] px-3.5 bg-accent text-accent-foreground hover:brightness-105 active:scale-[0.96]',
  secondary:
    'rounded-[9px] px-3.5 border border-[var(--line-2)] bg-transparent text-foreground hover:bg-[var(--surface-2)] active:scale-[0.96]',
  ghost: 'rounded-[9px] px-3.5 bg-transparent text-foreground/80 hover:text-foreground active:opacity-60',
  link: 'font-medium! text-accent-text hover:opacity-80',
}

/** 36 pt, or 32 pt inside a card row. A link has no box, so no height. */
const SIZE_CLASS: Record<ButtonSize, string> = { md: 'h-9', sm: 'h-8' }

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-1.5',
    'text-[13px] font-semibold transition-[transform,background-color,opacity,filter] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-40',
    variant !== 'link' && SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', className, ...rest },
  ref
) {
  return <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...rest} />
})

/** The same buttons for something that goes somewhere: a link, drawn as a button. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />
}
