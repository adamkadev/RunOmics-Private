'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { CardTitle } from '@/components/ui/SectionLabel'
import type { GarminRacePredictionsData } from '@/application/usecases/GetGarminRacePredictions'
import type { RaceDistanceKey } from '@/domain/race/distances'
import { paceTrend } from '@/domain/race/predictionWindow'
import { formatDurationShort, formatSignedDuration } from '@/lib/formatters'
import { metricDeltaColor } from '@/lib/colors'
import { t } from '@/i18n'

const ORDER: RaceDistanceKey[] = ['5k', '10k', 'half', 'marathon']
const SHORT_LABEL = t.analytics.raceTimes.shortLabels

export function RaceTimeCards({ data }: { data: GarminRacePredictionsData }) {
  const distances = ORDER.filter((d) => data.distances.includes(d) && data.latest[d] != null)
  if (distances.length === 0) return null

  return (
    <>
      <div className="mb-2.5 mt-1 flex items-center justify-between px-0.5">
        <CardTitle as="span">{t.analytics.raceTimes.title}</CardTitle>
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
                {trend && trend.improvementSec !== 0 ? (
                  <span
                    className="flex items-center gap-0.5 text-caption font-semibold tabular-nums"
                    style={{ color: metricDeltaColor(-trend.improvementSec, 'down', 0) }}
                  >
                    {trend.improvementSec > 0 ? (
                      <TrendingDown size={11} strokeWidth={3} />
                    ) : (
                      <TrendingUp size={11} strokeWidth={3} />
                    )}
                    {formatSignedDuration(-trend.improvementSec)}
                  </span>
                ) : (
                  <Minus size={14} strokeWidth={3} className="text-subtle" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
