import { Skeleton } from '@/components/ui/Skeleton'

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Skeleton className="mb-2 h-3 w-12" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-1 h-3 w-16" />
    </div>
  )
}

export default function GoalsLoading() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Annual goal */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-end justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </div>

      {/* Race targets */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>

      {/* Training zones */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>

      {/* Records */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
