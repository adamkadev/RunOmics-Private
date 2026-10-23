import { cn } from '@/lib/utils'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { Button } from '@/components/ui/Button'

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
  /** One action under the stats, full width (Districts' "Plan a run in …"); Heat sets none. */
  action?: { label: string; onClick: () => void }
  /**
   * The headline stands in for one on its way (Districts while its coverage
   * loads): it holds two lines, the height of the sentence it replaces and of
   * the one coming, so the card neither shrinks nor grows back. Heat sets none.
   */
  pending?: boolean
}

// A pure renderer: whoever owns the current area and filters decides what
// fact and which stats belong here, so the card never states something the
// map above it disagrees with.
export function TerritoryBand({ eyebrow, headline, stats, action, pending }: TerritoryCardContent) {
  return (
    <section
      className="flex flex-col gap-3.5 content-card rounded-[24px] bg-card shadow-[var(--card-edge)] p-4"
      data-testid="territory-card"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-1.5">
        <p className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{eyebrow}</p>
        <p className={cn('text-base font-medium leading-snug text-foreground [text-wrap:pretty]', pending && 'min-h-[2lh]')}>
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
      {action && (
        <Button size="lg" className="w-full" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </section>
  )
}
