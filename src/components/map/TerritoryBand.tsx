import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { GlassSurface } from '@/components/ui/GlassSurface'


interface Stat {
  value: string
  label: string
}

export interface TerritoryCardContent {
  eyebrow: string
  headline: string
  primaryStat: Stat
  secondaryStat: Stat
}

// A pure renderer: whoever owns the current area/world selection decides
// what fact and which two stats belong here, so the card never states
// something the map beneath it disagrees with.
export function TerritoryBand({ eyebrow, headline, primaryStat, secondaryStat }: TerritoryCardContent) {
  return (
    <GlassSurface variant="hero" className="flex flex-col gap-3.5">
      <div>
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>
          {eyebrow}
        </p>
        <p className="mt-2 font-display text-base font-bold leading-snug text-foreground">{headline}</p>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-foreground">{primaryStat.value}</div>
          <div className="text-caption text-muted-foreground">{primaryStat.label}</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-foreground">{secondaryStat.value}</div>
          <div className="text-caption text-muted-foreground">{secondaryStat.label}</div>
        </div>
      </div>
    </GlassSurface>
  )
}
