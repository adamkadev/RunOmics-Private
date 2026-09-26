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
  stats: Stat[]
}

// A pure renderer: whoever owns the current area and filters decides what
// fact and which stats belong here, so the card never states something the
// map above it disagrees with.
export function TerritoryBand({ eyebrow, headline, stats }: TerritoryCardContent) {
  return (
    <GlassSurface variant="hero" className="flex flex-col gap-3.5" data-testid="territory-card">
      <div className="flex flex-col gap-1.5">
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{eyebrow}</p>
        <p className="font-display text-[17px] font-semibold leading-snug text-foreground [text-wrap:pretty]">{headline}</p>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="font-display text-xl font-bold tabular-nums leading-none text-foreground">{stat.value}</span>
            <span className="text-caption text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
