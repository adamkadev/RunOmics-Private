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
        'flex min-h-15 items-center gap-3 px-4.5 py-2.5 transition-colors active:bg-foreground/[0.04]',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-subhead font-semibold text-foreground">{title}</span>
        {status && (
          <span className={cn('mt-0.5 block truncate text-footnote', tone === 'warn' ? 'text-delta-warn' : 'text-muted-foreground')}>
            {status}
          </span>
        )}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-subtle" />
    </Link>
  )
}
