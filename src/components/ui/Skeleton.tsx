import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  )
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(cardClass({ padding: 'lg' }), className)}>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-muted px-4 py-3">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-3 w-10" />
    </div>
  )
}
