import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead } from '@/components/ui/ChartCard'
import { ZONE_COLOR_CLASSES } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export function TrainingZones({ data }: { data: TrainingZonesData }) {
  const { thresholdPaceSecPerKm, zones } = data
  const easyZone = zones.find((z) => z.key === 'easy')
  const warmupPaceSecPerKm = easyZone ? easyZone.paceMaxSecPerKm + 1 : null
  const warmupStyle = ZONE_COLOR_CLASSES[1]

  return (
    <GlassSurface variant="card" className="p-5">
      <ChartCardHead
        title={t.trainingZones.title}
        footnote={
          <span className="flex flex-col gap-1">
            {zones.map((zone) => (
              <span key={zone.key}>
                <span className="font-semibold text-muted-foreground">{zone.label}</span> {zone.shortDesc}
              </span>
            ))}
          </span>
        }
      />
      <p className="mb-3 text-xs text-subtle">
        {t.trainingZones.subline(formatPace(thresholdPaceSecPerKm))}
      </p>

      <div className="divide-y divide-foreground/[0.06]">
        {warmupPaceSecPerKm !== null && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', warmupStyle?.bg)} />
              <span className={cn('truncate text-sm font-bold', warmupStyle?.text)}>
                {t.trainingZones.zones.warmup.label}
              </span>
              <span className="shrink-0 font-mono text-caption font-semibold text-subtle-2">
                {t.trainingZones.zoneNumber(1)}
              </span>
            </span>
            <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
              {fmt(warmupPaceSecPerKm)}+
              <span className="ml-1 text-caption font-normal text-subtle">{t.trainingZones.perKm}</span>
            </span>
          </div>
        )}
        {zones.map((zone) => {
          const style = ZONE_COLOR_CLASSES[zone.hrZone]

          return (
            <div key={zone.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', style?.bg)} />
                <span className={cn('truncate text-sm font-bold', style?.text)}>{zone.label}</span>
                <span className="shrink-0 font-mono text-caption font-semibold text-subtle-2">
                  {t.trainingZones.zoneNumber(zone.hrZone)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                {fmt(zone.paceMinSecPerKm)}-{fmt(zone.paceMaxSecPerKm)}
                <span className="ml-1 text-caption font-normal text-subtle">{t.trainingZones.perKm}</span>
              </span>
            </div>
          )
        })}
      </div>
    </GlassSurface>
  )
}
