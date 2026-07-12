import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

type ZoneStyle = { dot: string; text: string; bar: string }

const DEFAULT_ZONE_STYLE: ZoneStyle = { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' }

const ZONE_STYLE: Record<string, ZoneStyle> = {
  easy:      DEFAULT_ZONE_STYLE,
  marathon:  { dot: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       bar: 'bg-blue-500'    },
  threshold: { dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bar: 'bg-amber-500'   },
  vo2max:    { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         bar: 'bg-red-500'     },
}

export function TrainingZones({ data }: { data: TrainingZonesData }) {
  const { thresholdPaceSecPerKm, zones } = data

  // True fastest / slowest across every zone (data order is not guaranteed).
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
          const style = ZONE_STYLE[zone.key] ?? DEFAULT_ZONE_STYLE
          // Slow on the left, fast on the right: map slowest pace to 0%.
          const left = ((slowest - zone.paceMaxSecPerKm) / range) * 100
          const width = ((zone.paceMaxSecPerKm - zone.paceMinSecPerKm) / range) * 100

          return (
            <div key={zone.key} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <span className={`text-sm font-semibold ${style.text}`}>{zone.label}</span>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                  {fmt(zone.paceMinSecPerKm)}-{fmt(zone.paceMaxSecPerKm)}
                  <span className="ml-1 text-caption font-normal text-subtle">{t.trainingZones.perKm}</span>
                </span>
              </div>

              <div className="mt-2.5 h-2 w-full rounded-full bg-foreground/[0.07]">
                <div
                  className={`h-full rounded-full ${style.bar} opacity-70`}
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
