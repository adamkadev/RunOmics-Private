import { Skeleton } from '@/components/ui/Skeleton'

export default function MapLoading() {
  return (
    <div className="flex h-[calc(100dvh-7rem-max(env(safe-area-inset-top),12px))] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Map fills the rest */}
      <Skeleton className="flex-1 rounded-xl" />
    </div>
  )
}
