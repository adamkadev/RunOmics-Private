import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  tone?: 'default' | 'warn'
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors active:bg-[var(--fill-4)]',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-headline text-foreground">{title}</span>
        {status && (
          <span className={cn('mt-0.5 block truncate text-[13px]', tone === 'warn' ? 'text-[var(--warn)]' : 'text-muted-foreground')}>
            {status}
          </span>
        )}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-subtle" />
    </Link>
  )
}
