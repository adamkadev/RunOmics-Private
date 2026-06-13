import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-800',
        className
      )}
    />
  )
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900', className)}>
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-3 w-10" />
    </div>
  )
}
