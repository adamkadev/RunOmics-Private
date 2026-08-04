'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { RaceDistanceKey } from '@/domain/race/distances'
import { paceTrend } from '@/domain/race/predictionWindow'
import { formatDurationShort } from '@/lib/formatters'
import { t } from '@/i18n'

const ORDER: RaceDistanceKey[] = ['5k', '10k', 'half', 'marathon']
const SHORT_LABEL = t.analytics.raceTimes.shortLabels

// The four race distances as legible time cards with a trend arrow each -
// replaces the four-line predictor chart. Reads Garmin's own estimates via the
// same first-vs-last trend the Race Predictor chart itself uses, so the two
// views never disagree about which way a distance is moving.
export function RaceTimeCards({ data }: { data: GarminRacePredictionsData }) {
  const distances = ORDER.filter((d) => data.distances.includes(d) && data.latest[d] != null)
  if (distances.length === 0) return null

  return (
    <>
      <div className="mb-2.5 mt-1 flex items-center justify-between px-0.5">
        <span className="text-subhead font-semibold text-foreground">{t.analytics.raceTimes.title}</span>
        <span className="text-xs text-subtle">{t.analytics.raceTimes.trend}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {distances.map((key) => {
          const seconds = data.latest[key]!
          const trend = paceTrend(data.points, key)
          return (
            <div key={key} className="glass-row rounded-[13px] px-2 py-[11px] text-center">
              <div className="text-caption font-semibold text-subtle">{SHORT_LABEL[key]}</div>
              <div className="mt-[3px] font-display text-footnote font-bold tabular-nums text-foreground">
                {formatDurationShort(seconds)}
              </div>
              <div className="mt-[3px] flex justify-center">
                {trend && trend.improvementSec > 0 ? (
                  <TrendingDown size={14} strokeWidth={3} className="text-accent" />
                ) : trend && trend.improvementSec < 0 ? (
                  <TrendingUp size={14} strokeWidth={3} className="text-amber-500" />
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
