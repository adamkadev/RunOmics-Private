import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A hub row: a title, its live status line and a chevron, 60 pt tall - the
 * whole row is the target. Progress and Settings are lists of these.
 */
export function ListRow({
  href,
  title,
  status,
  tone = 'default',
  className,
}: {
  href: string
  title: string
  status?: string | null
  /** A status that needs acting on reads in the warning colour. */
  tone?: 'default' | 'warn'
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        // The v4.17 row: 14 x 20 padding, the inset surface on hover.
        'flex min-h-15 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {status && (
          <span className={cn('mt-0.5 block truncate text-xs', tone === 'warn' ? 'text-[var(--warn)]' : 'text-muted-foreground')}>
            {status}
          </span>
        )}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-subtle" />
    </Link>
  )
}
