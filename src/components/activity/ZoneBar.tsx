import type { HrZone } from '@/domain/activity/types'
import { formatDuration } from '@/lib/formatters'
import { Card } from '@/components/ui/Card'
import { t } from '@/i18n'

const ZONE_CONFIG: Record<number, {
  label: string
  barClass: string
  textClass: string
  trackClass: string
}> = {
  1: { label: t.activity.zones.labels[1], barClass: 'bg-gray-400',    textClass: 'text-muted-foreground',       trackClass: 'bg-muted' },
  2: { label: t.activity.zones.labels[2], barClass: 'bg-blue-400',    textClass: 'text-blue-600 dark:text-blue-400',       trackClass: 'bg-blue-50 dark:bg-blue-900/20' },
  3: { label: t.activity.zones.labels[3], barClass: 'bg-emerald-400', textClass: 'text-emerald-600 dark:text-emerald-400', trackClass: 'bg-emerald-50 dark:bg-emerald-900/20' },
  4: { label: t.activity.zones.labels[4], barClass: 'bg-orange-500',  textClass: 'text-orange-600 dark:text-orange-400',   trackClass: 'bg-orange-50 dark:bg-orange-900/20' },
  5: { label: t.activity.zones.labels[5], barClass: 'bg-red-500',     textClass: 'text-red-600 dark:text-red-400',         trackClass: 'bg-red-50 dark:bg-red-900/20' },
}

interface ZoneRowProps {
  zone: HrZone
}

function ZoneRow({ zone }: ZoneRowProps) {
  const cfg = ZONE_CONFIG[zone.zone]
  if (!cfg) return null
  const bpmLabel = zone.maxBpm
    ? t.activity.zones.range(zone.minBpm, zone.maxBpm)
    : t.activity.zones.rangeOpen(zone.minBpm)
  return (
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
      <div className={`h-2 w-full overflow-hidden rounded-full ${cfg.trackClass}`}>
        <div
          className={`h-full rounded-full transition-all ${cfg.barClass}`}
          style={{ width: `${zone.percent}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  hrZones: HrZone[]
}

export function ZoneBar({ hrZones }: Props) {
  if (!hrZones || hrZones.length === 0) {
    return (
      <Card padding="lg" className="flex h-full items-center justify-center">
        <p className="text-sm text-subtle">{t.activity.zones.noData}</p>
      </Card>
    )
  }

  const sorted = [...hrZones].sort((a, b) => b.zone - a.zone)

  return (
    <Card padding="lg">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.activity.zones.title}
      </h3>

      <div className="space-y-3">
        {sorted.map((z) => (
          <ZoneRow key={z.zone} zone={z} />
        ))}
      </div>
    </Card>
  )
}
