import { TrendingUp } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

const DIST_KM: Record<string, number> = {
  '1k': 1,
  '5k': 5,
  '10k': 10,
  'half': 21.0975,
  'marathon': 42.195,
}

function riegel(sourceSeconds: number, sourceKm: number, targetKm: number): number {
  return Math.round(sourceSeconds * Math.pow(targetKm / sourceKm, 1.06))
}

function bestSource(
  targetKey: string,
  records: RecordEntry[]
): { seconds: number; sourceLabel: string; sourceKm: number } | null {
  const targetKm = DIST_KM[targetKey]
  let best: { seconds: number; sourceLabel: string; sourceKm: number; ratio: number } | null = null

  for (const r of records) {
    if (r.seconds === null || r.key === targetKey) continue
    const sourceKm = DIST_KM[r.key]
    if (!sourceKm) continue
    const ratio = Math.abs(Math.log(targetKm / sourceKm))
    if (best === null || ratio < best.ratio) {
      best = { seconds: r.seconds, sourceLabel: r.label, sourceKm, ratio }
    }
  }
  return best
}

interface Props {
  records: RecordEntry[]
}

const EFFORTS = [
  //{ key: '1k', label: t.racePredictions.efforts['1k'], km: 1 },
  { key: '5k', label: t.racePredictions.efforts['5k'], km: 5 },
  { key: '10k', label: t.racePredictions.efforts['10k'], km: 10 },
  { key: 'half', label: t.racePredictions.efforts.half, km: 21.0975 },
  { key: 'marathon', label: t.racePredictions.efforts.marathon, km: 42.195 },
]

export function RacePredictions({ records }: Props) {
  const hasAny = records.some((r) => r.seconds !== null)
  if (!hasAny) return null

  const predictions = EFFORTS.map(({ key, label, km }) => {
    const actual = records.find((r) => r.key === key)
    const src = bestSource(key, records)
    const predicted = src ? riegel(src.seconds, src.sourceKm, km) : null

    return { key, label, km, actual, predicted, sourceLabel: src?.sourceLabel ?? null }
  })

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <TrendingUp size={14} className="text-emerald-500 dark:text-emerald-400" />
        {t.racePredictions.title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {predictions.map(({ key, label, km, actual, predicted, sourceLabel }) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <p className="text-xs font-semibold text-subtle">{label}</p>
            {predicted !== null ? (
              <>
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  ~{formatDuration(predicted)}
                </p>
                <p className="text-xs text-subtle">
                  {formatPace(Math.round(predicted / km))}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {t.racePredictions.from(sourceLabel ?? '')}
                </p>
                {actual?.seconds != null && (
                  <p className={`mt-0.5 text-xs font-medium ${actual.seconds <= predicted ? 'text-emerald-500 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                    {actual.seconds <= predicted
                      ? t.racePredictions.beatBy(formatDuration(predicted - actual.seconds))
                      : t.racePredictions.pbOff(formatDuration(actual.seconds - predicted))}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-subtle">-</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-subtle">
        {t.racePredictions.footnote}
      </p>
    </section>
  )
}
