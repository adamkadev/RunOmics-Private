import { Skeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

function ActivityRowSkeleton() {
  return (
    <div className={cardClass({ className: 'flex items-center gap-4' })}>
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="hidden space-y-2 sm:block">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

export default function ActivitiesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <ActivityRowSkeleton key={i} />)}
      </div>
    </div>
  )
}
