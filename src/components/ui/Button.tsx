import Link from 'next/link'
import { cn } from '@/lib/utils'
import { forwardRef, type ComponentProps } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-prominent rounded-full px-3.5 bg-accent text-accent-foreground hover:brightness-105',
  secondary: 'rounded-full px-3.5 bg-[var(--fill-3)] text-foreground',
  ghost: 'rounded-full px-3.5 bg-transparent text-foreground/80 hover:text-foreground active:opacity-60',
  link: 'font-medium! text-accent-text hover:opacity-80',
}

/** `lg`, the sheet footer CTA, is 50 pt so its capsule is concentric with the sheet's corner (47 - 22 = 25). */
const SIZE_CLASS: Record<ButtonSize, string> = { lg: 'h-[50px] px-6 text-[17px]', md: 'h-9', sm: 'h-8' }

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

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />
}
