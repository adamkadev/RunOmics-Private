import { Skeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

function CardSkeleton() {
  return (
    <div className={cardClass()}>
      <Skeleton className="mb-2 h-3 w-12" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-1 h-3 w-16" />
    </div>
  )
}

export default function RecordsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Records */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>

      {/* Race predictions */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
