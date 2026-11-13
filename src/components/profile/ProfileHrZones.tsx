import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cardClass } from '@/components/ui/Card'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

type Bounds = [number, number, number, number, number]

const HR_PERCENTS = [0.65, 0.8, 0.89, 0.95, 1.0]

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_6rem_5rem] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_120px_100px] sm:gap-3'
const ROW_GRID_NO_PACE = 'grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_100px] sm:gap-3'

/** Time in zones and its verdict live on Analytics alone: two windows and two verdicts disagreed. */
export const TIME_IN_ZONES_HREF = '/analytics?tab=health'

function defaultBounds(lthr: number): Bounds {
  return HR_PERCENTS.map((p) => Math.round(lthr * p)) as Bounds
}

function bpmRangeLabel(min: number, max: number | null): string {
  return max === null ? `≥ ${min}` : `${min}–${max}`
}

interface Props {
  athlete: Pick<AthleteProfile, 'lthrBpm' | 'maxHrBpm' | 'hrZoneBoundsBpm'>
  paceZones?: TrainingZonesData | null
}

export function ProfileHrZones({ athlete, paceZones }: Props) {
  const s = t.profile.trainingZones
  const lthr = athlete.lthrBpm
  const bounds = athlete.hrZoneBoundsBpm ?? (lthr !== undefined ? defaultBounds(lthr) : null)

  if (bounds === null) return null

  const paceByHrZone = new Map((paceZones?.zones ?? []).map((zone) => [zone.hrZone, zone]))
  const easyZone = paceByHrZone.get(2)
  const warmupPaceSecPerKm = easyZone ? easyZone.paceMaxSecPerKm + 1 : null

  const paceLabel = (zone: number): string | null => {
    if (zone === 1) return warmupPaceSecPerKm !== null ? `≥ ${fmt(warmupPaceSecPerKm)}` : null
    const pace = paceByHrZone.get(zone)
    return pace ? `${fmt(pace.paceMinSecPerKm)}–${fmt(pace.paceMaxSecPerKm)}` : null
  }

  // Z1 first, the order every zone list in the app uses.
  const zones = [
    { zone: 1, min: bounds[0], max: bounds[1] - 1 },
    { zone: 2, min: bounds[1], max: bounds[2] - 1 },
    { zone: 3, min: bounds[2], max: bounds[3] - 1 },
    { zone: 4, min: bounds[3], max: bounds[4] - 1 },
    { zone: 5, min: bounds[4], max: null as number | null },
  ].map((z) => ({ ...z, pace: paceLabel(z.zone) }))
  const showPace = zones.some((z) => z.pace !== null)
  const rowGrid = showPace ? ROW_GRID : ROW_GRID_NO_PACE
  const source = lthr !== undefined ? s.fromThreshold(lthr) : athlete.maxHrBpm !== undefined ? s.fromMax(athlete.maxHrBpm) : null

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3 rounded-[18px]' })} data-testid="training-zones">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-headline text-foreground">{s.title}</h2>
        {source && <span className="text-xs text-muted-foreground" data-testid="zones-source">{source}</span>}
      </div>

      <div>
        <div className={`${rowGrid} pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground`} data-testid="zone-columns">
          <span>{s.columnZone}</span>
          {showPace && <span className="whitespace-nowrap text-right">{s.columnPace}</span>}
          <span className="whitespace-nowrap text-right">{s.columnHr}</span>
        </div>

        {zones.map(({ zone, min, max, pace }) => (
          <div key={zone} className={`${rowGrid} min-h-[38px] border-t border-border py-1.5`} data-testid={`zone-row-${zone}`}>
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(--zone-${zone})` }} />
              <span className="min-w-0 leading-tight">
                <b className="font-semibold">{t.trainingZones.zoneNumber(zone)}</b> {t.zoneLabels[zone]}
              </span>
            </span>
            {showPace && <span className="whitespace-nowrap text-right text-xs tabular-nums text-[var(--text-2)]">{pace ?? '-'}</span>}
            <span className="whitespace-nowrap text-right text-xs tabular-nums text-[var(--text-2)]">{bpmRangeLabel(min, max)}</span>
          </div>
        ))}
        {!showPace && <p className="border-t border-border pt-2 text-[12px] text-muted-foreground text-pretty" data-testid="hr-only">{s.hrOnly}</p>}
        {paceZones?.estimate && (
          <p className="border-t border-border pt-2 text-[12px] text-muted-foreground text-pretty" data-testid="pace-estimate">
            {s.estimatedPaces(t.records.distances[paceZones.estimate.effort] ?? paceZones.estimate.effort, formatDate(paceZones.estimate.date))}
          </p>
        )}
      </div>

      <Link href={TIME_IN_ZONES_HREF} className="hit-44 flex items-center justify-between border-t border-border pt-2.5 text-[13px] font-medium text-foreground" data-testid="time-in-zones-link">
        {s.timeInZones}
        <ChevronRight size={16} aria-hidden className="text-subtle" />
      </Link>
    </section>
  )
}
