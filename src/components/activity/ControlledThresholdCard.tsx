import type { SessionVerdict } from '@/application/coaching/autoregulation'
import { CONTROLLED_THRESHOLD } from '@/application/coaching/controlledThreshold'
import type { ControlledRunView } from '@/application/coaching/controlledRunView'
import { cardClass } from '@/components/ui/Card'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { formatClock } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const VERDICT_TONE: Record<SessionVerdict, StatusTone> = {
  under: 'zinc',
  on_target: 'good',
  over: 'warn',
  off_guide: 'neutral',
  unreadable: 'neutral',
}

const ROW = 'grid w-full items-center gap-x-2.5 grid-cols-[1.375rem_minmax(0,1fr)_2.75rem_2.25rem_2.25rem]'
const TOLERANCE = CONTROLLED_THRESHOLD.autoregulation.guideToleranceSecPerKm

/** Faster to the right, the guide shaded: a tick off the guide is amber before any number is read. */
function PaceTrack({ pace, guide, slow, fast }: { pace: number; guide: { min: number; max: number }; slow: number; fast: number }) {
  const at = (sec: number) => ((slow - Math.min(Math.max(sec, fast), slow)) / (slow - fast)) * 100
  const off = pace < guide.min - TOLERANCE || pace > guide.max + TOLERANCE
  return (
    <span className="relative block h-2 w-full rounded-full bg-[var(--track)]" data-testid="pace-track">
      <span aria-hidden className="absolute inset-y-0 bg-[var(--band)]" style={{ left: `${at(guide.max)}%`, right: `${100 - at(guide.min)}%` }} />
      <span
        aria-hidden
        data-off={off ? '' : undefined}
        className={cn('absolute -top-[3px] -bottom-[3px] w-1 rounded-sm', off ? 'bg-[var(--warn)]' : 'bg-[var(--data-done)]')}
        style={{ left: `calc(${at(pace)}% - 2px)` }}
      />
    </span>
  )
}

function verdictLabel(verdict: SessionVerdict, reps: { paceSecPerKm: number }[], guide: { min: number; max: number }): string {
  const s = t.coaching.controlledRun
  if (verdict !== 'off_guide') return s.verdicts[verdict]
  return reps.some((rep) => rep.paceSecPerKm < guide.min - TOLERANCE) ? s.offGuideFaster : s.offGuideSlower
}

export function ControlledThresholdCard({ view: { reading, windowStartSeconds } }: { view: ControlledRunView }) {
  const s = t.coaching.controlledRun
  const { targetHr: target, ceilingHr: ceiling, reps, guide } = reading
  const slow = Math.max(guide.max + 10, ...reps.map((rep) => rep.paceSecPerKm + 3))
  const fast = Math.min(guide.min - 10, ...reps.map((rep) => rep.paceSecPerKm - 3))

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="controlled-threshold">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-headline text-foreground">{s.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.guideLine(s.repClass[reading.repClass], `${formatClock(guide.min)}–${formatClock(guide.max)}`)}</p>
        </div>
        <StatusPill tone={VERDICT_TONE[reading.verdict]} className="mt-0.5 shrink-0">
          <span data-testid="controlled-verdict">{verdictLabel(reading.verdict, reps, guide)}</span>
        </StatusPill>
      </div>

      {reps.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={cn(ROW, 'text-caption uppercase tracking-[0.06em] text-muted-foreground')}>
            <span>{s.cols.rep}</span>
            <span className="flex justify-between normal-case tracking-normal">
              <span>{s.slower}</span>
              <span>{s.faster}</span>
            </span>
            <span className="text-right">{s.cols.pace}</span>
            <span className="text-right">{s.cols.hr}</span>
            <span className="text-right">{s.cols.peak}</span>
          </div>
          {reps.map((rep, index) => (
            <div key={index} className={cn(ROW, 'min-h-6 text-subhead')} data-testid="controlled-rep">
              <span className="tabular-nums text-foreground">{index + 1}</span>
              <PaceTrack pace={rep.paceSecPerKm} guide={guide} slow={slow} fast={fast} />
              <span className="text-right font-bold tabular-nums text-foreground">{formatClock(rep.paceSecPerKm)}</span>
              <span className={cn('text-right tabular-nums', rep.windowHr > target ? 'text-[var(--warn)]' : 'text-foreground')}>
                {rep.windowHr}
              </span>
              <span className={cn('text-right tabular-nums', rep.windowMaxHr >= ceiling ? 'text-[var(--warn)]' : 'text-muted-foreground')}>
                {rep.windowMaxHr}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-border pt-2.5 text-xs text-muted-foreground text-pretty">
        {s.footnote(Math.round(windowStartSeconds / 60), target, ceiling)}
      </p>
    </section>
  )
}
