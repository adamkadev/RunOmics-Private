'use client'

import { TrendingDown, Minus } from 'lucide-react'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { RaceDistanceKey } from '@/domain/race/distances'
import { formatDurationShort } from '@/lib/formatters'
import { t } from '@/i18n'

const ORDER: RaceDistanceKey[] = ['5k', '10k', 'half', 'marathon']
const SHORT_LABEL: Record<RaceDistanceKey, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half',
  marathon: 'Mara',
}

// Improving if the latest predicted finish is meaningfully faster than the
// earliest one on record for that distance (5s+ tighter).
function isImproving(points: GarminRacePredictionsData['points'], key: RaceDistanceKey): boolean {
  const paces = points.map((p) => p[key]).filter((v): v is number => v !== null)
  const first = paces[0]
  const last = paces[paces.length - 1]
  if (first === undefined || last === undefined) return false
  return first - last > 5
}

// The four race distances as legible time cards with a trend arrow each -
// replaces the four-line predictor chart. Reads Garmin's own estimates.
export function RaceTimeCards({ data }: { data: GarminRacePredictionsData }) {
  const distances = ORDER.filter((d) => data.distances.includes(d) && data.latest[d] != null)
  if (distances.length === 0) return null

  return (
    <>
      <div className="mb-2.5 mt-1 flex items-center justify-between px-0.5">
        <span className="text-[15px] font-semibold text-foreground">{t.analytics.tabs.performance}</span>
        <span className="text-xs text-subtle">{t.analytics.raceTimes.trend}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {distances.map((key) => {
          const seconds = data.latest[key]!
          const improving = isImproving(data.points, key)
          return (
            <div key={key} className="rounded-[13px] border border-border bg-card px-2 py-[11px] text-center">
              <div className="text-[9.5px] font-semibold text-subtle">{SHORT_LABEL[key]}</div>
              <div className="mt-[3px] font-display text-[13.5px] font-bold tabular-nums text-foreground">
                {formatDurationShort(seconds)}
              </div>
              <div className="mt-[3px] flex justify-center">
                {improving ? (
                  <TrendingDown size={14} strokeWidth={3} className="text-accent" />
                ) : (
                  <Minus size={14} strokeWidth={3} className="text-subtle-2" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
