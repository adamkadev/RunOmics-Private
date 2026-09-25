import type { HrZone } from '@/domain/activity/types'
import { collapseUnusedZones, zoneRangeLabel } from '@/domain/activity/zoneRows'
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
}

export function ZoneBar({ hrZones }: Props) {
  if (!hrZones || hrZones.length === 0) {
    return (
      <GlassSurface variant="card" className="flex h-full items-center justify-center p-5">
        <p className="text-sm text-subtle">{t.activity.zones.noData}</p>
      </GlassSurface>
    )
  }

  const sorted = [...hrZones].sort((a, b) => b.zone - a.zone)
  const rows = collapseUnusedZones(
    sorted.map((zone) => ({ zone: zone.zone, used: zone.percent > 0, data: zone })),
  )

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{t.activity.zones.title}</h3>
        {/* The basis, not a second average: the stat row owns avg HR, and a
            max read off smoothed samples printed as 120.2. */}
        <span className="text-xs text-subtle">{t.activity.zones.basisHr}</span>
      </div>

      <div className="space-y-1">
        {rows.map((row) =>
          row.kind === 'zone' ? (
            <ZoneRow key={row.zone} zone={row.data} />
          ) : (
            <p key={`unused-${row.zones.join('-')}`} className="px-2 py-0.5 text-caption text-subtle">
              {t.activity.zones.unused(zoneRangeLabel(row.zones))}
            </p>
          ),
        )}
      </div>
    </GlassSurface>
  )
}