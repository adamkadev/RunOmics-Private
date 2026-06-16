import { Skeleton } from '@/components/ui/Skeleton'

function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return <Skeleton className="h-16 w-full rounded-xl" />
}

export default function CoachLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Training status banner */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Week summary + load deltas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </div>

      {/* 4-week training plan */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
