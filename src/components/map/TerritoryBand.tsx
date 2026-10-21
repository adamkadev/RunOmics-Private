import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { Stat, StatGrid } from '@/components/ui/Stat'

interface TerritoryStat {
  label: string
  value: string
  unit?: string
}

export interface TerritoryCardContent {
  eyebrow: string
  /** The sentence, with the ring it names set apart in the accent. */
  headline: { lead: string; accent: string; tail: string }
  stats: TerritoryStat[]
}

// A pure renderer: whoever owns the current area and filters decides what
// fact and which stats belong here, so the card never states something the
// map above it disagrees with.
export function TerritoryBand({ eyebrow, headline, stats }: TerritoryCardContent) {
  return (
    <section
      className="flex flex-col gap-3.5 content-card rounded-[24px] bg-card shadow-[var(--card-edge)] p-4"
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
      {/* The v4.17 stat: label on top, the value with its unit. */}
      <StatGrid columns={stats.length} className="border-t border-border pt-3.5">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} unit={stat.unit} valueStyle={{ fontSize: 24 }} />
        ))}
      </StatGrid>
    </section>
  )
}
