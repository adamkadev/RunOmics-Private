import { Gauge } from 'lucide-react'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt } from '@/lib/formatters'
import { t } from '@/i18n'

const ZONE_STYLE: Record<string, { dot: string; text: string; bg: string; bar: string }> = {
  easy:      { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8',  bar: 'bg-emerald-500' },
  marathon:  { dot: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/8',    bar: 'bg-blue-500'    },
  threshold: { dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/8',   bar: 'bg-amber-500'   },
  vo2max:    { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/8',     bar: 'bg-red-500'     },
}

export function TrainingZones({ data }: { data: TrainingZonesData }) {
  const { vo2max, zones } = data

  // Compute bar widths relative to pace range (faster = wider bar)
  const allMax = zones[zones.length - 1].paceMaxSecPerKm  // slowest pace (easy zone slow end)
  const allMin = zones[0].paceMinSecPerKm                 // fastest pace (vo2max fast end)
  const range = allMax - allMin

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Gauge size={14} className="text-violet-500 dark:text-violet-400" />
          {t.trainingZones.title}
        </h2>
        <span className="text-xs text-subtle">{t.trainingZones.vdot(vo2max)}</span>
      </div>

      <div className="space-y-2">
        {zones.map((zone) => {
          const style = ZONE_STYLE[zone.key]
          // Bar spans from zone's fast end to slow end, relative to total pace range
          const barLeft = ((zone.paceMinSecPerKm - allMin) / range) * 100
          const barWidth = ((zone.paceMaxSecPerKm - zone.paceMinSecPerKm) / range) * 100

          return (
            <div
              key={zone.key}
              className={`rounded-xl border border-border ${style.bg} p-4 shadow-card`}
            >
              <div className="flex items-start gap-4">
                {/* Left: label + description */}
                <div className="w-28 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <span className={`text-xs font-semibold ${style.text}`}>{zone.label}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {zone.shortDesc}
                  </p>
                </div>

                {/* Center: pace bar */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="relative h-2 rounded-full bg-border">
                    <div
                      className={`absolute h-full rounded-full ${style.bar} opacity-60`}
                      style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-subtle">
                    <span>{fmt(allMin)} {t.trainingZones.perKm}</span>
                    <span>{fmt(allMax)} {t.trainingZones.perKm}</span>
                  </div>
                </div>

                {/* Right: pace range */}
                <div className="shrink-0 text-right">
                  <p className="font-mono text-base font-bold tabular-nums text-foreground">
                    {fmt(zone.paceMinSecPerKm)}–{fmt(zone.paceMaxSecPerKm)}
                  </p>
                  <p className="text-[11px] text-subtle">{t.trainingZones.perKm}</p>
                </div>
              </div>

              <p className="mt-2 text-[11px] text-subtle">{zone.example}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
