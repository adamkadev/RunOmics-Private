import type { HrZone } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'

const ZONE_CONFIG: Record<number, {
  label: string
  barClass: string
  textClass: string
}> = Object.fromEntries(
  Object.entries(ZONE_COLOR_CLASSES).map(([zone, { bg, text }]) => [
    zone,
    { label: t.activity.zones.labels[Number(zone)] ?? '', barClass: bg, textClass: text },
  ])
)

const TRACK_CLASS = 'bg-[var(--track)]'

// The card's whole rule is one hue per zone. Its own header broke it by painting
// avg and max zone-5 red regardless, so an average of 157 read as a red-zone
// number on a run that spent most of its time in Z2.
export function zoneTextClass(bpm: number, zones: HrZone[]): string {
  const hit = zones.find((z) => bpm >= z.minBpm && (z.maxBpm === null || bpm <= z.maxBpm))
  return (hit && ZONE_COLOR_CLASSES[hit.zone]?.text) ?? 'text-foreground'
}

interface ZoneRowProps {
  zone: HrZone
}

function ZoneRow({ zone }: ZoneRowProps) {
  const cfg = ZONE_CONFIG[zone.zone]
  if (!cfg) return null
  return (
    <div className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-foreground/[0.04]')}>
      <span className={cn('shrink-0 text-left text-xs font-medium', cfg.textClass)}>{cfg.label.split(' ')[0]}</span>
      <div className={`h-2 flex-1 overflow-hidden rounded-full ${TRACK_CLASS}`}>
        <div
          className={cn('h-full rounded-full transition-all', cfg.barClass)}
          style={{ width: `${zone.percent}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{zone.percent}%</span>
    </div>
  )
}

interface Props {
  hrZones: HrZone[]
  avgHr?: number | null
  maxHr?: number | null
}

export function ZoneBar({ hrZones, avgHr, maxHr }: Props) {
  if (!hrZones || hrZones.length === 0) {
    return (
      <GlassSurface variant="card" className="flex h-full items-center justify-center p-5">
        <p className="text-sm text-subtle">{t.activity.zones.noData}</p>
      </GlassSurface>
    )
  }

  const sorted = [...hrZones].sort((a, b) => b.zone - a.zone)

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.zones.title}</h3>
        {(avgHr || maxHr) && (
          <span className="text-xs text-subtle">
            {avgHr && (
              <>{t.activity.charts.avg} <span className={cn('font-semibold', zoneTextClass(avgHr, hrZones))}>{avgHr}</span></>
            )}
            {avgHr && maxHr && ' · '}
            {maxHr && (
              <>{t.activity.charts.max} <span className={cn('font-semibold', zoneTextClass(maxHr, hrZones))}>{maxHr}</span></>
            )}
            {' '}{t.units.bpm}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {sorted.map((z) => (
          <ZoneRow key={z.zone} zone={z} />
        ))}
      </div>
    </GlassSurface>
  )
}