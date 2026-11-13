import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The large title's line, so a 44 pt button beside it sits on the title's centre line. */
const TITLE_LINE = 'h-[var(--text-large-title--line-height)]'

/** The back circle (44 pt) and the 12 pt gap after it: the subtitle starts under the title, not under the button. */
const UNDER_TITLE = 'pl-14'

type TitleProps = HTMLAttributes<HTMLHeadingElement> & { [data: `data-${string}`]: string | undefined }

/** Back, title and right-hand buttons share one line: a title is one line, cut short only as a last resort. */
export function PageHeader({
  title,
  back,
  backOnPhoneOnly = false,
  action,
  eyebrow,
  children,
  titleProps,
  className,
  ...rest
}: {
  title: ReactNode
  back?: ReactNode
  /** A wide screen has the sidebar for the way back. */
  backOnPhoneOnly?: boolean
  action?: ReactNode
  eyebrow?: ReactNode
  /** The subtitle lines, which the compact bar fades as they scroll under it. */
  children?: ReactNode
  titleProps?: TitleProps
  className?: string
} & { [data: `data-${string}`]: string | undefined }) {
  const indent = back ? cn(UNDER_TITLE, backOnPhoneOnly && 'lg:pl-0') : undefined
  return (
    <header className={cn('flex flex-col', className)} {...rest}>
      {eyebrow && <div className={cn('mb-1', indent)}>{eyebrow}</div>}
      <div className="flex items-start gap-3">
        {back && <div className={cn('flex shrink-0 items-center', TITLE_LINE, backOnPhoneOnly && 'lg:hidden')}>{back}</div>}
        <h1 {...titleProps} className={cn('min-w-0 flex-1 truncate text-display text-foreground', titleProps?.className)}>
          {title}
        </h1>
        {action && <div className={cn('flex shrink-0 items-center gap-2', TITLE_LINE)}>{action}</div>}
      </div>
      {children && (
        <div data-title-sub className={cn('mt-0.5 flex flex-col gap-0.5', indent)}>
          {children}
        </div>
      )}
    </header>
  )
}
