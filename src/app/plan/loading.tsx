import { Skeleton } from '@/components/ui/Skeleton'

function DaySkeleton() {
  return (
    <div className="glass-row rounded-lg p-2">
      <Skeleton className="mb-2 h-3 w-5" />
      <div className="space-y-1">
        <Skeleton className="h-2.5 w-full rounded" />
        <Skeleton className="h-2.5 w-3/4 rounded" />
      </div>
    </div>
  )
}

export default function PlanLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="py-1 text-center">
            <Skeleton className="mx-auto h-3 w-4" />
          </div>
        ))}
      </div>

      {/* Plan grid -5 weeks */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => <DaySkeleton key={i} />)}
      </div>
    </div>
  )
}
