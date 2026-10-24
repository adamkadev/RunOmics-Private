import { cardClass } from '@/components/ui/Card'
import type { RunExploreGain } from '@/domain/explore/gains'
import { COMPLETE_PCT } from '@/domain/explore/types'
import { formatPercent } from '@/lib/formatters'
import { t } from '@/i18n'

const SHOWN_UNITS = 3

export function NewGround({ gain }: { gain: RunExploreGain }) {
  const s = t.activity.newGround
  const units = gain.units.filter((unit) => unit.after > unit.before).slice(0, SHOWN_UNITS)
  if (units.length === 0) return null
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="new-ground">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-headline text-foreground">{s.title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">{s.cells(gain.newCells)}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {units.map((unit) => {
          const crossed = unit.before < COMPLETE_PCT && unit.after >= COMPLETE_PCT
          return (
            <div key={unit.id} className="flex flex-col gap-1.5" data-testid="new-ground-unit">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words font-medium text-foreground">{unit.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatPercent(unit.before)} → <b className={crossed ? 'text-[var(--pos)]' : 'text-foreground'}>{formatPercent(unit.after)}</b>
                  {crossed && <span className="ml-1.5 text-[var(--pos)]">{s.complete}</span>}
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden>
                <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--muted-foreground)] opacity-40" style={{ width: `${unit.before}%` }} />
                <div className="absolute inset-y-0 rounded-full bg-[var(--accent)]" style={{ left: `${unit.before}%`, width: `${unit.after - unit.before}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
