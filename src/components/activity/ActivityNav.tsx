import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface AdjacentActivity {
  id: string
  dayOfWeek: string
  description: string
}

interface Props {
  prev: AdjacentActivity | null
  next: AdjacentActivity | null
}

function activityLabel(activity: AdjacentActivity): string {
  return activity.description || t.activity.runTitle(activity.dayOfWeek)
}

function NavLink({ activity, direction }: { activity: AdjacentActivity | null; direction: 'prev' | 'next' }) {
  if (!activity) return <div className="flex-1 px-4 py-3" aria-hidden="true" />

  const isPrev = direction === 'prev'
  return (
    <Link
      href={`/activities/${activity.id}`}
      className={cn(
        'flex flex-1 items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.04]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isPrev ? 'justify-start' : 'justify-end text-right'
      )}
    >
      {isPrev && <ChevronLeft size={16} className="shrink-0 text-muted-foreground" />}
      <span className="min-w-0">
        <span className="block text-micro font-medium uppercase tracking-wide text-muted-foreground">
          {isPrev ? t.activity.nav.previous : t.activity.nav.next}
        </span>
        <span className="block truncate font-semibold text-foreground">{activityLabel(activity)}</span>
      </span>
      {!isPrev && <ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
    </Link>
  )
}

export function ActivityNav({ prev, next }: Props) {
  if (!prev && !next) return null

  return (
    <GlassSurface variant="card" className="flex items-stretch divide-x divide-border overflow-hidden p-0">
      <NavLink activity={prev} direction="prev" />
      <NavLink activity={next} direction="next" />
    </GlassSurface>
  )
}
