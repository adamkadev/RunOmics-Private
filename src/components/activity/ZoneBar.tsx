import type { HrZone } from '@/domain/activity/types'
import { formatDuration } from '@/lib/formatters'

const ZONE_CONFIG: Record<number, {
  label: string
  barClass: string
  textClass: string
  trackClass: string
}> = {
  1: { label: 'Z1 · Warmup',    barClass: 'bg-gray-400',    textClass: 'text-gray-500 dark:text-gray-400',       trackClass: 'bg-gray-100 dark:bg-gray-800' },
  2: { label: 'Z2 · Easy',      barClass: 'bg-blue-400',    textClass: 'text-blue-600 dark:text-blue-400',       trackClass: 'bg-blue-50 dark:bg-blue-900/20' },
  3: { label: 'Z3 · Aerobic',   barClass: 'bg-emerald-400', textClass: 'text-emerald-600 dark:text-emerald-400', trackClass: 'bg-emerald-50 dark:bg-emerald-900/20' },
  4: { label: 'Z4 · Threshold', barClass: 'bg-orange-500',  textClass: 'text-orange-600 dark:text-orange-400',   trackClass: 'bg-orange-50 dark:bg-orange-900/20' },
  5: { label: 'Z5 · Max',       barClass: 'bg-red-500',     textClass: 'text-red-600 dark:text-red-400',         trackClass: 'bg-red-50 dark:bg-red-900/20' },
}

const STACKED_BAR_COLORS = [
  'bg-gray-400',
  'bg-blue-400',
  'bg-emerald-400',
  'bg-orange-500',
  'bg-red-500',
]

interface ZoneRowProps {
  zone: HrZone
}

function ZoneRow({ zone }: ZoneRowProps) {
  const cfg = ZONE_CONFIG[zone.zone]
  if (!cfg) return null
  const bpmLabel = zone.maxBpm
    ? `${zone.minBpm}–${zone.maxBpm} bpm`
    : `>${zone.minBpm} bpm`
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${cfg.textClass}`}>{cfg.label}</span>
          <span className="text-gray-400 dark:text-gray-500">{bpmLabel}</span>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-gray-500 dark:text-gray-400">{formatDuration(zone.seconds)}</span>
          <span className="w-10 text-right font-semibold text-gray-900 dark:text-white">{zone.percent}%</span>
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
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-400 dark:text-gray-500">No HR zone data</p>
      </div>
    )
  }

  const sorted = [...hrZones].sort((a, b) => b.zone - a.zone)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
        Heart Rate Zones
      </h3>

      <div className="mb-5 flex h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        {sorted.map((z) => (
          <div
            key={z.zone}
            className={`h-full ${STACKED_BAR_COLORS[z.zone - 1] ?? 'bg-gray-300'}`}
            style={{ width: `${z.percent}%` }}
            title={`Z${z.zone}: ${z.percent}%`}
          />
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((z) => (
          <ZoneRow key={z.zone} zone={z} />
        ))}
      </div>
    </div>
  )
}
