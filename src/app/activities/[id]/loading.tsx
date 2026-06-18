import { Skeleton, ChartCardSkeleton, StatCardSkeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

export default function ActivityDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-24" />

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-7 w-56" />
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Map + side panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className={cardClass({ padding: 'lg' })}>
            <Skeleton className="mb-4 h-4 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
          <div className={cardClass({ padding: 'lg' })}>
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <ChartCardSkeleton key={i} className="h-[180px]" />)}
      </div>
    </div>
  )
}
