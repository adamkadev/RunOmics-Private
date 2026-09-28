import { Skeleton, ChartCardSkeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

/** The page's own shape while it loads (v4.17): header, map card, verdict, tabs, a card. */
export default function ActivityDetailLoading() {
  return (
    <div className="flex flex-col gap-3.5">
      <Skeleton className="h-4 w-24" />

      <div className="mb-1.5 flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-44" />
      </div>

      <div className={cardClass({ padding: 'none', overflow: true })}>
        <Skeleton className="h-[260px] w-full rounded-none sm:h-[320px]" />
        <div className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass({ className: 'flex flex-col gap-3' })}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between border-t border-border pt-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-1.5 h-[42px] w-full rounded-[11px]" />
      <ChartCardSkeleton className="h-[180px]" />
    </div>
  )
}
