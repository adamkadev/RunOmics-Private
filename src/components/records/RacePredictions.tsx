import { TrendingUp } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

const DIST_KM: Record<string, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}

function riegel(sourceSeconds: number, sourceKm: number, targetKm: number): number {
  return Math.round(sourceSeconds * Math.pow(targetKm / sourceKm, 1.06))
}

function bestSource(
  targetKey: string,
  records: RecordEntry[]
): { seconds: number; sourceLabel: string; sourceKm: number; eventName?: string } | null {
  const targetKm = DIST_KM[targetKey]
  let best: {
    seconds: number
    sourceLabel: string
    sourceKm: number
    eventName?: string
    ratio: number
  } | null = null

  for (const r of records) {
    if (r.seconds === null || r.key === targetKey || !DIST_KM[r.key]) continue
    const sourceKm = DIST_KM[r.key]
    const ratio = Math.abs(Math.log(targetKm / sourceKm))
    if (best === null || ratio < best.ratio) {
      best = { seconds: r.seconds, sourceLabel: r.label, sourceKm, eventName: r.eventName, ratio }
    }
  }
  return best
}

const EFFORTS = [
  { key: '5k',       label: t.racePredictions.efforts['5k'],    km: 5        },
  { key: '10k',      label: t.racePredictions.efforts['10k'],   km: 10       },
  { key: 'half',     label: t.racePredictions.efforts.half,     km: 21.0975  },
  { key: 'marathon', label: t.racePredictions.efforts.marathon, km: 42.195   },
]

interface Props {
  records: RecordEntry[]
}

export function RacePredictions({ records }: Props) {
  const hasAny = records.some((r) => r.seconds !== null && DIST_KM[r.key] != null)
  if (!hasAny) return null

  const predictions = EFFORTS.map(({ key, label, km }) => {
    const actual = records.find((r) => r.key === key)
    const src = bestSource(key, records)
    const predicted = src ? riegel(src.seconds, src.sourceKm, km) : null
    return { key, label, km, actual, predicted }
  }).filter(({ predicted }) => predicted !== null)

  if (!predictions.length) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <TrendingUp size={14} className="text-emerald-500 dark:text-emerald-400" />
        {t.racePredictions.title}
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {predictions.map(({ key, label, km, actual, predicted }) => {
          return (
            <div key={key} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <p className="text-xs font-semibold text-subtle">{label}</p>
              <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-foreground">
                ~{formatDuration(predicted!)}
              </p>
              <p className="text-xs text-subtle">{formatPace(Math.round(predicted! / km))}</p>
              {actual?.seconds != null && (
                <p
                  className={`mt-0.5 text-xs font-medium ${
                    actual.seconds <= predicted!
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-orange-500 dark:text-orange-400'
                  }`}
                >
                  {actual.seconds <= predicted!
                    ? t.racePredictions.beatBy(formatDuration(predicted! - actual.seconds))
                    : t.racePredictions.pbOff(formatDuration(actual.seconds - predicted!))}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-subtle">{t.racePredictions.footnote}</p>
    </section>
  )
}
