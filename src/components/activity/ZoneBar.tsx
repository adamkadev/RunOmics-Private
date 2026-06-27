'use client'

import type { HrZone } from '@/domain/activity/types'
import { formatDuration } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const ZONE_CONFIG: Record<number, {
  label: string
  barClass: string
  textClass: string
}> = Object.fromEntries(
  Object.entries(ZONE_COLOR_CLASSES).map(([zone, { bg, text }]) => [
    zone,
    { label: t.activity.zones.labels[Number(zone)], barClass: bg, textClass: text },
  ])
)

const TRACK_CLASS = 'bg-[rgba(11,31,23,0.07)] dark:bg-[rgba(255,255,255,0.08)]'

interface ZoneRowProps {
  zone: HrZone
  active: boolean
  onSelect: (zone: number) => void
}

function ZoneRow({ zone, active, onSelect }: ZoneRowProps) {
  const cfg = ZONE_CONFIG[zone.zone]
  if (!cfg) return null
  const bpmLabel = zone.maxBpm
    ? t.activity.zones.range(zone.minBpm, zone.maxBpm)
    : t.activity.zones.rangeOpen(zone.minBpm)
  return (
    <button
      type="button"
      onClick={() => onSelect(zone.zone)}
      className={cn(
        'w-full rounded-lg px-2 py-1.5 text-left transition-colors',
        active ? 'bg-foreground/[0.08]' : 'hover:bg-foreground/[0.04]'
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${cfg.textClass}`}>{cfg.label}</span>
            <span className="text-subtle">{bpmLabel}</span>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-muted-foreground">{formatDuration(zone.seconds)}</span>
            <span className="w-10 text-right font-semibold text-foreground">{zone.percent}%</span>
          </div>
        </div>
        <div className={`h-2 w-full overflow-hidden rounded-full ${TRACK_CLASS}`}>
          <div
            className={cn('h-full rounded-full transition-all', cfg.barClass)}
            style={{ width: `${zone.percent}%` }}
          />
        </div>
      </div>
    </button>
  )
}

interface Props {
  hrZones: HrZone[]
  activeZone?: number | null
  onZoneSelect?: (zone: number) => void
}

export function ZoneBar({ hrZones, activeZone, onZoneSelect }: Props) {
  if (!hrZones || hrZones.length === 0) {
    return (
      <GlassSurface variant="card" className="flex h-full items-center justify-center p-5">
        <p className="text-sm text-subtle">{t.activity.zones.noData}</p>
      </GlassSurface>
    )
  }

  const sorted = [...hrZones].sort((a, b) => b.zone - a.zone)
  const handleSelect = onZoneSelect ?? (() => {})

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.activity.zones.title}
      </h3>

      <div className="space-y-1">
        {sorted.map((z) => (
          <ZoneRow
            key={z.zone}
            zone={z}
            active={activeZone === z.zone}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </GlassSurface>
  )
}
