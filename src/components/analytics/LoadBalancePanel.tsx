import type { LoadBalanceBucket, LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

// A low ACWR is genuinely benign, which is why LoadRiskPanel's "low" is blue.
// A below-target intensity band is not benign - it is a gap in the training that
// wants action - so it carries the same caution tone as overshooting one.
//
// The row has no verdict chip any more - the marker against the band is the
// verdict, and three chips down a column repeated what three markers already
// showed. The value keeps the tone, so an off-target row is visible without
// reading the band.
const VERDICT_INK: Record<LoadBalanceBucket['verdict'], string> = {
  below: STATUS.warning.text,
  onTarget: 'text-foreground',
  above: STATUS.warning.text,
}

// The header chip carries the card's actual finding, so it should not be the one
// neutral element on it.
const FEEDBACK_TONE: Record<string, StatusTone> = {
  ON_TARGET: 'green',
  BELOW_TARGETS: 'amber',
  ABOVE_TARGETS: 'amber',
  LACKING_HIGH_AEROBIC: 'amber',
  LACKING_LOW_AEROBIC: 'amber',
  LACKING_ANAEROBIC: 'amber',
  ANAEROBIC_SHORTAGE: 'amber',
  NO_DATA: 'zinc',
}

function GaugeRow({ bucket }: { bucket: LoadBalanceBucket }) {
  const s = t.loadBalance
  const { targetStart, targetEnd, position } = bucket
  const rangeLabel = `${s.buckets[bucket.id]} ${bucket.load} · ${s.range(bucket.targetMin, bucket.targetMax)} · ${s.verdict[bucket.verdict]}`

  return (
    <div className="grid grid-cols-[minmax(0,5.5rem)_1fr_auto] items-center gap-3 py-2">
      <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{s.buckets[bucket.id]}</span>

      <div
        className="relative h-1.5 rounded-full bg-foreground/[0.10]"
        role="img"
        aria-label={rangeLabel}
        title={rangeLabel}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-500/35"
          style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${position}%` }}
        />
      </div>

      <span className={cn('text-subhead font-bold tabular-nums', VERDICT_INK[bucket.verdict])}>
        {bucket.load}
      </span>
    </div>
  )
}

export function LoadBalancePanel({ data }: { data: LoadBalanceData }) {
  const s = t.loadBalance

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground/80">
          {s.title} <span className="font-normal text-subtle">{s.window}</span>
        </h2>
        {data.feedback && (
          <StatusPill tone={FEEDBACK_TONE[data.feedback] ?? 'zinc'}>
            {s.feedback[data.feedback] ?? data.feedback}
          </StatusPill>
        )}
      </div>

      <div className="divide-y divide-foreground/[0.06]">
        {data.buckets.map((bucket) => (
          <GaugeRow key={bucket.id} bucket={bucket} />
        ))}
      </div>

      <p className="mt-3 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
