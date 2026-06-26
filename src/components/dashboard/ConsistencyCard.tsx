import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConsistencyScore, ConsistencyRating } from '@/application/usecases/GetConsistencyScore'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const RATING_STYLE: Record<ConsistencyRating, { tone: StatusTone; text: string }> = {
  excellent: { tone: 'emerald', text: STATUS.success.text },
  good:      { tone: 'blue',   text: STATUS.progress.text },
  fair:      { tone: 'amber',  text: STATUS.warning.text },
  low:       { tone: 'zinc',   text: STATUS.pending.text },
}

const RING_SIZE = 72
const RING_STROKE = 6
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function scoreGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 55) return 'B'
  return 'C'
}

// Decorative progress ring; the score is already conveyed as text, so it's hidden from a11y tree.
function ConsistencyRing({ score }: { score: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(score, 100) / 100)
  const grade = scoreGrade(score)
  return (
    <div className="relative h-[72px] w-[72px] flex-shrink-0">
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" aria-hidden="true">
        {grade}
      </div>
    </div>
  )
}

export function ConsistencyCard({ data }: { data: ConsistencyScore }) {
  const s = t.consistencyScore
  const style = RATING_STYLE[data.rating]

  return (
    <GlassSurface variant="card" className="flex h-full flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw size={16} className={style.text} />
        <h3 className="widget-label text-muted-foreground">{s.title}</h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className={cn('text-3xl font-bold tabular-nums', style.text)}>
            {data.score}
            <span className="ml-0.5 text-base font-normal text-muted-foreground">/100</span>
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <StatusPill tone={style.tone}>{s.rating[data.rating]}</StatusPill>
            <span className="text-xs text-muted-foreground">
              {data.activeWeeks}/{data.totalWeeks} {s.weeks}
            </span>
          </div>
        </div>
        <span className={style.text}>
          <ConsistencyRing score={data.score} />
        </span>
      </div>
    </GlassSurface>
  )
}
