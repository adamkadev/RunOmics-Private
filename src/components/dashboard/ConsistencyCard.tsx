import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConsistencyScore, ConsistencyRating } from '@/application/usecases/GetConsistencyScore'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const RATING_STYLE: Record<ConsistencyRating, { tone: StatusTone; text: string }> = {
  excellent: { tone: 'emerald', text: STATUS.success.text },
  good:      { tone: 'blue',   text: 'text-blue-600 dark:text-blue-400' },
  fair:      { tone: 'amber',  text: 'text-amber-600 dark:text-amber-400' },
  low:       { tone: 'zinc',   text: 'text-zinc-500' },
}

const RING_SIZE = 56
const RING_STROKE = 5
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// Decorative progress ring; the score is already conveyed as text, so it's hidden from a11y tree.
function ConsistencyRing({ score }: { score: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(score, 100) / 100)
  return (
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
  )
}

export function ConsistencyCard({ data }: { data: ConsistencyScore }) {
  const s = t.consistencyScore
  const style = RATING_STYLE[data.rating]

  return (
    <GlassSurface variant="card" className="flex h-full flex-col rounded-[22px] p-5">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw size={14} className={style.text} />
        <h3 className="text-sm font-semibold text-foreground/80">{s.title}</h3>
        <StatusPill tone={style.tone}>{s.rating[data.rating]}</StatusPill>
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('text-3xl font-bold tabular-nums', style.text)}>
          {data.score}
          <span className="ml-0.5 text-base font-normal text-muted-foreground">/100</span>
        </span>
        <span className={style.text}>
          <ConsistencyRing score={data.score} />
        </span>
      </div>
    </GlassSurface>
  )
}
