import { ChartCardSkeleton, StatCardSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Volume chart full width */}
      <ChartCardSkeleton className="h-[280px]" />

      {/* Grid of charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => <ChartCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
