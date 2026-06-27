'use client'

import type { ConsistencyScore, ConsistencyRating } from '@/application/usecases/GetConsistencyScore'
import { tierFromPercentile } from '@/domain/athlete/rank'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { RankExplainPanel } from '@/components/ui/RankExplainPanel'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const RATING_TEXT_CLASS: Record<ConsistencyRating, string> = {
  excellent: STATUS.success.text,
  good:      STATUS.progress.text,
  fair:      STATUS.warning.text,
  low:       STATUS.pending.text,
}

// Decorative; the grade is restated as plain text in the explanation panel below.
function ConsistencyRing({ grade }: { grade: string }) {
  return (
    <div
      className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full border-[6px] border-current text-xs font-bold"
      aria-hidden="true"
    >
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
