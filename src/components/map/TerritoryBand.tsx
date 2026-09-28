import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'

interface Stat {
  value: string
  label: string
}

export interface TerritoryCardContent {
  eyebrow: string
  /** The sentence, with the ring it names set apart in the accent. */
  headline: { lead: string; accent: string; tail: string }
  stats: Stat[]
}

// A pure renderer: whoever owns the current area and filters decides what
// fact and which stats belong here, so the card never states something the
// map above it disagrees with.
export function TerritoryBand({ eyebrow, headline, stats }: TerritoryCardContent) {
  return (
    <section
      className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card px-[18px] pb-4 pt-[18px]"
      data-testid="territory-card"
    >
      <div className="flex flex-col gap-1.5">
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{eyebrow}</p>
        <p className="text-base font-medium leading-snug text-foreground [text-wrap:pretty]">
          {headline.lead}
          <span className="text-accent-text">{headline.accent}</span>
          {headline.tail}
        </p>
      </div>
      <div
        className="grid gap-4 border-t border-border pt-3.5"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] font-semibold tabular-nums leading-tight text-foreground">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
