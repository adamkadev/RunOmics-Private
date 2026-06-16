import { Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton'

export default function ProfileLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Identity card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="mt-3 h-3 w-64" />
      </div>

      {/* Career stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Training zones */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>

      {/* Records summary */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
