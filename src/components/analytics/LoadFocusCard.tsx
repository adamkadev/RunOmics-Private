'use client'

import type { LoadBalanceBucket, LoadBalanceData } from '@/application/usecases/GetLoadBalance'
import { t } from '@/i18n'
import { Card, CardHead, Sentence } from './AnalyticsKit'
import { loadFocusView } from './loadRecoveryView'

/** A gap below a band wants action as much as an overshoot, so both read as caution. */
const VERDICT_INK: Record<LoadBalanceBucket['verdict'], string> = {
  below: 'var(--warn)',
  onTarget: 'var(--foreground)',
  above: 'var(--warn)',
}

function FocusRow({ bucket }: { bucket: LoadBalanceBucket }) {
  const s = t.loadBalance
  const ink = VERDICT_INK[bucket.verdict]
  const name = s.buckets[bucket.id]
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)_44px] items-center gap-3" data-testid={`focus-${bucket.id}`} data-verdict={bucket.verdict}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] leading-tight text-[var(--text-2)]">{name}</span>
        <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">{s.range(bucket.targetMin, bucket.targetMax)}</span>
      </span>
      <div
        className="relative h-2 rounded-full bg-[var(--line-2)]"
        role="img"
        aria-label={`${name} ${bucket.load} · ${s.range(bucket.targetMin, bucket.targetMax)} · ${s.verdict[bucket.verdict]}`}
      >
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: `${bucket.targetStart}%`, width: `${bucket.targetEnd - bucket.targetStart}%`, background: 'color-mix(in srgb, var(--pos) 35%, transparent)' }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${bucket.position}%`, background: ink }}
          data-testid="focus-marker"
        />
      </div>
      <b className="text-right text-[15px] font-semibold tabular-nums" style={{ color: ink }}>
        {bucket.load}
      </b>
    </div>
  )
}

export function LoadFocusCard({ balance, today }: { balance: LoadBalanceData | null; today: string }) {
  const s = t.loadBalance
  const view = loadFocusView(balance, today)
  if (!view) return null
  return (
    <Card testId="load-focus-card">
      <CardHead title={s.title} caption={s.window} about={s.footnote} />
      <Sentence testId="load-focus-phrase">
        <b style={{ color: view.phrase === 'BALANCED' ? 'var(--pos)' : 'var(--warn)' }}>{s.feedback[view.phrase]}</b>
      </Sentence>
      <div className="flex flex-col gap-3">
        {view.buckets.map((bucket) => (
          <FocusRow key={bucket.id} bucket={bucket} />
        ))}
      </div>
    </Card>
  )
}
