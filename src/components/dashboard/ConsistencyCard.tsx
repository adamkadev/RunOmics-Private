'use client'

import type { ConsistencyScore, ConsistencyRating } from '@/application/usecases/GetConsistencyScore'
import { tierFromPercentile } from '@/domain/athlete/rank'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { RankExplainPanel } from '@/components/ui/RankExplainPanel'
import { STATUS } from '@/lib/statusColors'
import { useCountUp } from '@/lib/useCountUp'
import { t } from '@/i18n'

const RATING_TEXT_CLASS: Record<ConsistencyRating, string> = {
  excellent: STATUS.success.text,
  good:      STATUS.progress.text,
  fair:      STATUS.warning.text,
  low:       STATUS.pending.text,
}

const RING_SIZE = 72
const RING_STROKE = 6
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// Decorative; the grade is restated as plain text in the explanation panel below.
// Always animates to a full ring, independent of the score value.
function ConsistencyRing({ grade }: { grade: string }) {
  const animatedFill = useCountUp(100)
  const offset = RING_CIRCUMFERENCE * (1 - animatedFill / 100)

  return (
    <div
      className="relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center text-xs font-bold"
      aria-hidden="true"
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="absolute -rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-current opacity-15"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          className="stroke-current"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      {grade}
    </div>
  )
}

export function ConsistencyCard({ data }: { data: ConsistencyScore }) {
  const s = t.consistencyScore
  const textClass = RATING_TEXT_CLASS[data.rating]
  const grade = tierFromPercentile(data.score)

  return (
    <GlassSurface variant="card" className="flex h-full flex-col p-5">
      <div className="flex items-center gap-4">
        <span className={textClass}>
          <ConsistencyRing grade={grade} />
        </span>
        <div className="flex flex-col justify-center">
          <span className="flex items-baseline gap-1.5 font-normal text-foreground">
            <span>{s.title}</span>
            <span className="tabular-nums">
              <AnimatedValue value={data.score} />/100
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {data.activeWeeks}/{data.totalWeeks} {s.weeks}
          </span>
        </div>
      </div>
      <RankExplainPanel tier={grade} description={s.gradeExplain} />
    </GlassSurface>
  )
}
