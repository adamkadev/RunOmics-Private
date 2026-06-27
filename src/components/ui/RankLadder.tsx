import { Check } from 'lucide-react'
import { RANK_LADDER, type RankTier } from '@/domain/athlete/rank'
import { cn } from '@/lib/utils'

export function RankLadder({ current }: { current: RankTier }) {
  return (
    <div className="flex flex-wrap gap-1">
      {RANK_LADDER.map((tier) => {
        const active = tier === current
        return (
          <span
            key={tier}
            className={cn(
              'flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-bold',
              active ? 'bg-accent text-accent-foreground' : 'bg-foreground/[0.08] text-muted-foreground'
            )}
          >
            {tier}
            {active && <Check size={10} strokeWidth={3} aria-hidden="true" />}
          </span>
        )
      })}
    </div>
  )
}
