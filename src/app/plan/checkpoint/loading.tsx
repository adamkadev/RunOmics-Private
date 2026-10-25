import { Skeleton } from '@/components/ui/Skeleton'
import { cardClass } from '@/components/ui/Card'

export default function CheckpointLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="size-11 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cardClass({ className: 'space-y-3' })}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ))}
    </div>
  )
}
