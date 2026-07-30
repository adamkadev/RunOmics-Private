import type { LoadBalanceBucket, LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { t } from '@/i18n'

const VERDICT_TONE: Record<LoadBalanceBucket['verdict'], StatusTone> = {
  below: 'blue',
  onTarget: 'green',
  above: 'amber',
}

function Gauge({ bucket }: { bucket: LoadBalanceBucket }) {
  const s = t.loadBalance
  const { targetStart, targetEnd, position } = bucket

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5">
      <div className="widget-label mb-1.5 text-muted-foreground">{s.buckets[bucket.id]}</div>
      <div className="flex items-center gap-2">
        <span className="text-title2 font-extrabold tabular-nums text-foreground">{bucket.load}</span>
      </div>
      <div className="mt-1.5">
        <StatusPill tone={VERDICT_TONE[bucket.verdict]}>{s.verdict[bucket.verdict]}</StatusPill>
      </div>

      <div className="relative mt-3 h-1.5 rounded-full bg-foreground/[0.10]">
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-500/35"
          style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${position}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        {s.range(bucket.targetMin, bucket.targetMax)}
      </p>
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
        {data.feedback && <StatusPill tone="zinc">{s.feedback[data.feedback] ?? data.feedback}</StatusPill>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.buckets.map((bucket) => (
          <Gauge key={bucket.id} bucket={bucket} />
        ))}
      </div>

      <p className="mt-3 text-xs text-subtle">{s.footnote}</p>
    </GlassSurface>
  )
}
