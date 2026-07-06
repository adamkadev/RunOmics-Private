'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import type { RacePacePlan } from '@/application/usecases/GetRacePacePlan'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDuration, formatClock } from '@/lib/formatters'
import { t } from '@/i18n'

type Strategy = 'even' | 'negative'

export function PacePlan({ data }: { data: RacePacePlan }) {
  const s = t.racePacePlan
  const [strategy, setStrategy] = useState<Strategy>('even')
  const splits = strategy === 'even' ? data.even : data.negative
  const title = data.raceName ? s.titleWithRace(data.raceName) : s.title

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Flag size={16} className="text-accent-text" />
        {title}
      </h2>

      <GlassSurface variant="card" className="rounded-card-sm p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight text-foreground">
              {s.target(formatDuration(data.targetSeconds))}
            </p>
            {data.isEstimated && <p className="text-xs text-subtle">{s.estimated}</p>}
            {data.zoneLabel && data.zonePaceRange && (
              <p className="text-xs text-subtle">
                {s.zoneContext(
                  data.zoneLabel,
                  `${formatClock(data.zonePaceRange[0])}-${formatClock(data.zonePaceRange[1])}`,
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-0.5 rounded-control border border-foreground/10 bg-foreground/[0.07] p-[3px]">
            {(['even', 'negative'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStrategy(key)}
                className={
                  strategy === key
                    ? 'rounded-[7px] bg-foreground/[0.14] px-2.5 py-1 text-caption font-semibold text-foreground'
                    : 'rounded-[7px] px-2.5 py-1 text-caption font-semibold text-muted-foreground'
                }
              >
                {key === 'even' ? s.even : s.negative}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-foreground/[0.08]">
          <div className="grid grid-cols-3 gap-2 border-b border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{s.km}</span>
            <span className="text-right">{t.units.perKm}</span>
            <span className="text-right">{s.cumulative}</span>
          </div>
          {splits.map((split) => (
            <div key={split.km} className="grid grid-cols-3 gap-2 border-b border-foreground/[0.05] px-3 py-1.5 text-sm last:border-0">
              <span className="font-semibold text-foreground">{split.km}</span>
              <span className="text-right tabular-nums text-foreground">{formatClock(split.paceSecPerKm)}</span>
              <span className="text-right tabular-nums text-muted-foreground">{formatDuration(split.cumulativeSeconds)}</span>
            </div>
          ))}
        </div>
      </GlassSurface>
    </section>
  )
}
