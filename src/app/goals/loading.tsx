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

export default function GoalsLoading() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="mb-1.5 flex items-end justify-between">
        <div className="space-y-3.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-[11px]" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className={cardClass({ padding: 'lg' })}>
          <div className="mb-3 flex items-end justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>

    </div>
  )
}
