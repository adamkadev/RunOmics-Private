import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { activityTitle } from '@/lib/activityTitle'

interface AdjacentActivity {
  id: string
  date: string
  dayOfWeek: string
  description: string
}

interface Props {
  prev: AdjacentActivity | null
  next: AdjacentActivity | null
}

function activityLabel(activity: AdjacentActivity): string {
  return activityTitle(activity)
}

function NavLink({ activity, direction }: { activity: AdjacentActivity | null; direction: 'prev' | 'next' }) {
  if (!activity) return null

  const isPrev = direction === 'prev'
  return (
    <Link
      href={`/activities/${activity.id}`}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isPrev ? 'justify-start' : 'justify-end text-right'
      )}
    >
      {isPrev && <ChevronLeft size={16} className="shrink-0 text-muted-foreground" />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn(EYEBROW_CLASS, 'font-normal text-muted-foreground')}>
          {isPrev ? t.activity.nav.previous : t.activity.nav.next}
        </span>
        {/* A phone's half-width link keeps only the name. */}
        <span className="truncate text-sm font-semibold text-foreground">
          {activityLabel(activity)}
          <span className="hidden sm:inline"> · {formatDate(activity.date)}</span>
        </span>
      </span>
      {!isPrev && <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
    </Link>
  )
}

export function ActivityNav({ prev, next }: Props) {
  if (!prev && !next) return null

  return (
    <nav className={cardClass({ padding: 'none', overflow: true, className: 'flex items-stretch divide-x divide-border' })}>
      <NavLink activity={prev} direction="prev" />
      <NavLink activity={next} direction="next" />
    </nav>
  )
}
