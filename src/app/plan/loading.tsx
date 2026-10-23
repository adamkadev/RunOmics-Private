import { Skeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

export default function PlanLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-[11px]" />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className={cardClass({ className: 'flex flex-col gap-2.5 py-4' })}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        <div className={cardClass({ className: 'flex flex-col gap-4 pt-4' })}>
          <div className="flex items-center justify-between">
            <Skeleton className="size-[30px] rounded-lg" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-[30px] rounded-lg" />
          </div>
          <div className="grid h-[150px] grid-cols-7 items-end gap-1.5 sm:gap-2.5">
            {['h-[40%]', 'h-[70%]', 'h-[60%]', 'h-[70%]', 'h-2', 'h-[60%]', 'h-full'].map((height, i) => (
              <Skeleton key={i} className={`w-full rounded-lg ${height}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass({ padding: 'none', overflow: true })}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
