import { ActivityCardSkeleton } from '@/components/activities/ActivityCardSkeleton'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ActivitiesLoading() {
  return (
    <div className="space-y-4">
      <div className="glass-row rounded-2xl px-5 py-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-3.5 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <ActivityCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
