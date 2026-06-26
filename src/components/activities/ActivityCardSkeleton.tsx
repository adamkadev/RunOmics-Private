/** Glass skeleton card for the activities list - shown only on first load (loading.tsx). */
export function ActivityCardSkeleton() {
  return (
    <div className="skeleton-shimmer rounded-card-sm border border-foreground/[0.07] bg-foreground/[0.03] p-4">
      <div className="h-3.5 w-[55%] rounded-md bg-foreground/[0.08]" />
      <div className="mt-2.5 h-2.5 w-[30%] rounded bg-foreground/[0.05]" />
      <div className="mt-3 flex gap-2">
        <div className="h-2.5 flex-1 rounded bg-foreground/[0.05]" />
        <div className="h-2.5 flex-1 rounded bg-foreground/[0.05]" />
        <div className="h-2.5 flex-1 rounded bg-foreground/[0.05]" />
        <div className="h-2.5 flex-1 rounded bg-foreground/[0.05]" />
      </div>
    </div>
  )
}
