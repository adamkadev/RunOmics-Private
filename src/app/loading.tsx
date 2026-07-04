import { Skeleton } from '@/components/ui/Skeleton'

// Mirrors the v2 dashboard layout: greeting, weekly stats glass card,
// charts, recent activities - so the swap to real content doesn't jump.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Weekly stats card */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-foreground/[0.08] px-4 py-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-5 gap-2 px-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-5">
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="h-[180px] w-full" />
          </div>
        ))}
      </div>

      {/* Recent activities */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-foreground/[0.08] px-5 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[14px]" />
          ))}
        </div>
      </div>
    </div>
  )
}
