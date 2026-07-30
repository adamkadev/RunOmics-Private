import type { RaceReadiness } from '@/application/usecases/GetRaceReadiness'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Badge } from '@/components/ui/Card'
import { formatClock, formatDateFull, formatPace } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  readiness: RaceReadiness | null
}

const VERDICT_STATUS = {
  underRested: STATUS.warning,
  ready: STATUS.success,
  overRested: STATUS.warning,
} as const

function Tile({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3">
      <p className="text-micro text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 font-display text-subhead font-bold tabular-nums text-foreground', className)}>{value}</p>
      {hint && <p className="mt-0.5 text-micro text-subtle-2">{hint}</p>}
    </div>
  )
}

function signed(tsb: number): string {
  return `${tsb > 0 ? '+' : ''}${tsb.toFixed(1)}`
}

export function RaceCountdown({ readiness }: Props) {
  if (!readiness) return null

  const { race, daysUntil, phase, tsb, projectedTsb, projectedVerdict, predictedSeconds, targetPaceSecPerKm } = readiness
  const r = t.goals.raceReadiness

  return (
    <GlassSurface variant="card" className="space-y-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-title3 font-bold text-foreground">{race.name}</h2>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {[race.distance, race.location, formatDateFull(race.date)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Badge className="shrink-0 bg-accent/10 font-semibold text-accent-text">{r.countdown(daysUntil)}</Badge>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">{r.phases[phase]}</p>
        <p className="text-caption text-subtle">{r.phaseBody[phase]}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label={r.formToday} value={signed(tsb)} />
        <Tile
          label={r.formOnRaceDay}
          value={signed(projectedTsb)}
          hint={r.verdict[projectedVerdict]}
          className={VERDICT_STATUS[projectedVerdict].text}
        />
        <Tile
          label={r.predictedTime}
          value={predictedSeconds ? formatClock(predictedSeconds) : '-'}
          hint={targetPaceSecPerKm ? formatPace(targetPaceSecPerKm) : undefined}
        />
      </div>

      <p className="text-micro text-subtle-2">{r.assumption}</p>
    </GlassSurface>
  )
}
