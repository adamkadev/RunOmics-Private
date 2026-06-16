import { Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton'

export default function RecordsLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Records wall */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>

      {/* Race predictions */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
