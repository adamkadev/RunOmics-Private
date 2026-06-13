import { TrendingUp } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import { formatDuration, formatPace } from '@/lib/formatters'

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
  { key: '1k', label: '1K', km: 1 },
  { key: '5k', label: '5K', km: 5 },
  { key: '10k', label: '10K', km: 10 },
  { key: 'half', label: 'Half', km: 21.0975 },
  { key: 'marathon', label: 'Marathon', km: 42.195 },
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
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <TrendingUp size={14} className="text-emerald-500" />
        Race Predictions
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {predictions.map(({ key, label, km, actual, predicted, sourceLabel }) => (
          <div
            key={key}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{label}</p>
            {predicted !== null ? (
              <>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  ~{formatDuration(predicted)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatPace(Math.round(predicted / km))}
                </p>
                <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
                  from {sourceLabel}
                </p>
                {actual?.seconds != null && (
                  <p className={`mt-0.5 text-xs font-medium ${actual.seconds <= predicted ? 'text-emerald-500' : 'text-orange-400'}`}>
                    {actual.seconds <= predicted
                      ? `✓ Beat by ${formatDuration(predicted - actual.seconds)}`
                      : `PB ${formatDuration(actual.seconds - predicted)} off`}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-300 dark:text-gray-600">-</p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Riegel formula · t₂ = t₁ × (d₂/d₁)^1.06
      </p>
    </section>
  )
}
