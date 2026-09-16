import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export function TrainingZones({ data }: { data: TrainingZonesData }) {
  const { thresholdPaceSecPerKm, zones } = data

  const paces = zones.flatMap((z) => [z.paceMinSecPerKm, z.paceMaxSecPerKm])
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  const range = slowest - fastest || 1

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground/80">
          {t.trainingZones.title}
        </h2>
        <span className="text-xs text-subtle">{t.trainingZones.thresholdLabel(formatPace(thresholdPaceSecPerKm))}</span>
      </div>

      <div className="space-y-2">
        {zones.map((zone) => {
          const style = ZONE_COLOR_CLASSES[zone.hrZone]
          const left = ((slowest - zone.paceMaxSecPerKm) / range) * 100
          const width = ((zone.paceMaxSecPerKm - zone.paceMinSecPerKm) / range) * 100

          return (
            <div key={zone.key} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', style?.bg)} />
                  <span className={cn('text-sm font-semibold', style?.text)}>{zone.label}</span>
                  <span className="font-mono text-caption font-semibold text-subtle">
                    {t.trainingZones.zoneNumber(zone.hrZone)}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                  {fmt(zone.paceMinSecPerKm)}-{fmt(zone.paceMaxSecPerKm)}
                  <span className="ml-1 text-caption font-normal text-subtle">{t.trainingZones.perKm}</span>
                </span>
              </div>

              <div className="mt-2.5 h-2 w-full rounded-full bg-foreground/[0.07]">
                <div
                  className={cn('h-full rounded-full opacity-70', style?.bg)}
                  style={{ marginLeft: `${left}%`, width: `${Math.max(width, 3)}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {zone.shortDesc}
                <span className="text-subtle"> · {zone.example}</span>
              </p>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
