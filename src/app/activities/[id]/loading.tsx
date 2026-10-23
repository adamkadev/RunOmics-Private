import { Skeleton, ChartCardSkeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

export default function ActivityDetailLoading() {
  return (
    <div className="flex flex-col gap-3.5">
      <Skeleton className="-mx-4 h-[330px] w-auto rounded-none sm:-mx-6 lg:mx-0 lg:rounded-3xl" />

      <div className="-mt-1 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="grid grid-cols-4 gap-x-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      <div className={cardClass({ className: 'flex flex-col gap-3' })}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-64" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[30px] w-20 rounded-lg" />
          ))}
        </div>
      </div>

      <Skeleton className="mt-1.5 h-[42px] w-full rounded-[11px]" />
      <ChartCardSkeleton className="h-[180px]" />
    </div>
  )
}
