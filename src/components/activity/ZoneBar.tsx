import type { HrZone } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'

interface Props {
  hrZones: HrZone[]
}

/** Under this share a segment is too thin to carry its own percentage. */
const LABEL_MIN_PCT = 12
/** Under this share a segment is too thin for even its zone name. */
const NAME_MIN_PCT = 6

/**
 * Time in heart-rate zones as one stacked bar, Z1 to Z5, with the zone the run
 * spent most time in as the card's one qualifier. Five bar rows under an avg
 * and a max repeated the stat row and did not say which zones they were.
 */
export function ZoneBar({ hrZones }: Props) {
  const z = t.activity.zones
  if (!hrZones || hrZones.length === 0) {
    return (
      <GlassSurface variant="card" className="flex h-full items-center justify-center p-5">
        <p className="text-sm text-subtle">{z.noData}</p>
      </GlassSurface>
    )
  }

  const zones = [...hrZones].sort((a, b) => a.zone - b.zone)
  const used = zones.filter((zone) => zone.percent > 0)
  const top = used.reduce<HrZone | null>((best, zone) => (!best || zone.percent > best.percent ? zone : best), null)

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground/80">{z.title}</h3>
        {top && <span className="text-xs text-subtle">{z.mostIn(top.zone, Math.round(top.percent))}</span>}
      </div>

      <div className="flex h-3 gap-0.5" data-testid="zone-stack">
        {used.map((zone) => (
          <span
            key={zone.zone}
            className={cn('h-full rounded-full', ZONE_COLOR_CLASSES[zone.zone]?.bg)}
            style={{ flexGrow: zone.percent, flexBasis: 0 }}
            title={`Z${zone.zone} ${Math.round(zone.percent)}%`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex gap-0.5 text-caption tabular-nums text-muted-foreground" aria-hidden="true">
        {used.map((zone) => (
          <span key={zone.zone} className="min-w-0 overflow-hidden whitespace-nowrap" style={{ flexGrow: zone.percent, flexBasis: 0 }}>
            {/* A sliver of a segment has no room for its name: it clipped to "Z". */}
            {zone.percent >= NAME_MIN_PCT && `Z${zone.zone}`}
            {zone.percent >= LABEL_MIN_PCT && ` ${Math.round(zone.percent)}%`}
          </span>
        ))}
      </div>

      <ul className="sr-only">
        {zones.map((zone) => (
          <li key={zone.zone}>{`Z${zone.zone} · ${t.zoneLabels[zone.zone] ?? ''}: ${Math.round(zone.percent)}%`}</li>
        ))}
      </ul>
    </GlassSurface>
  )
}
