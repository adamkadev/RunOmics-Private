import { Skeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

function RowSkeleton() {
  return (
    <div className={cardClass({ className: 'flex items-center gap-3' })}>
      <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  )
}

export default function MilestonesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
