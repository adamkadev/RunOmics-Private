import { Gauge } from 'lucide-react'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import { formatClock as fmt } from '@/lib/formatters'
import { t } from '@/i18n'

const ZONE_STYLE: Record<string, { dot: string; text: string; bar: string }> = {
  easy:      { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  marathon:  { dot: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',       bar: 'bg-blue-500'    },
  threshold: { dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bar: 'bg-amber-500'   },
  vo2max:    { dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         bar: 'bg-red-500'     },
}

export function TrainingZones({ data }: { data: TrainingZonesData }) {
  const { vo2max, zones } = data

  // True fastest / slowest across every zone (data order is not guaranteed).
  const paces = zones.flatMap((z) => [z.paceMinSecPerKm, z.paceMaxSecPerKm])
  const fastest = Math.min(...paces)
  const slowest = Math.max(...paces)
  const range = slowest - fastest || 1

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Gauge size={14} className="text-violet-500 dark:text-violet-400" />
          {t.trainingZones.title}
        </h2>
        <span className="text-xs text-subtle">{t.trainingZones.vo2maxLabel(vo2max)}</span>
      </div>

      <div className="space-y-2">
        {zones.map((zone) => {
          const style = ZONE_STYLE[zone.key] ?? ZONE_STYLE.easy
          // Slow on the left, fast on the right: map slowest pace to 0%.
          const left = ((slowest - zone.paceMaxSecPerKm) / range) * 100
          const width = ((zone.paceMaxSecPerKm - zone.paceMinSecPerKm) / range) * 100

          return (
            <div key={zone.key} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <span className={`text-sm font-semibold ${style.text}`}>{zone.label}</span>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                  {fmt(zone.paceMinSecPerKm)}-{fmt(zone.paceMaxSecPerKm)}
                  <span className="ml-1 text-[11px] font-normal text-subtle">{t.trainingZones.perKm}</span>
                </span>
              </div>

              <div className="mt-2.5 h-2 w-full rounded-full bg-muted">
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
    </section>
  )
}
