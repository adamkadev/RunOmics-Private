import type { SessionVerdict } from '@/application/coaching/autoregulation'
import type { ControlledRunView } from '@/application/coaching/controlledRunView'
import { cardClass } from '@/components/ui/Card'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { formatClock } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const VERDICT_TONE: Record<SessionVerdict, StatusTone> = {
  under: 'accent',
  on_target: 'good',
  over: 'warn',
  off_guide: 'neutral',
  unreadable: 'neutral',
}

const ROW = 'grid w-full items-center gap-x-2.5 grid-cols-[1.375rem_minmax(0,1fr)_2.75rem_2.25rem_2.25rem]'


/** The ceiling's side of the track is shaded, so a tick inside it reads as over before any number does. */
function HrTrack({ hr, target, ceiling, low, high }: { hr: number; target: number; ceiling: number; low: number; high: number }) {
  const at = (bpm: number) => ((Math.min(Math.max(bpm, low), high) - low) / (high - low)) * 100
  return (
    <span className="relative block h-2 w-full rounded-full bg-[var(--track)]" data-testid="hr-track">
      <span aria-hidden className="absolute inset-y-0 bg-[var(--band)]" style={{ left: `${at(target)}%`, right: `${100 - at(ceiling)}%` }} />
      <span
        aria-hidden
        className={cn('absolute -top-[3px] -bottom-[3px] w-1 rounded-sm', hr > target ? 'bg-[var(--warn)]' : 'bg-accent')}
        style={{ left: `calc(${at(hr)}% - 2px)` }}
      />
    </span>
  )
}

export function ControlledThresholdCard({ view: { reading, windowStartSeconds } }: { view: ControlledRunView }) {
  const s = t.coaching.controlledRun
  const { targetHr: target, ceilingHr: ceiling, reps } = reading
  const low = Math.min(target - 10, ...reps.map((rep) => rep.windowHr - 2))
  const high = Math.max(ceiling + 4, ...reps.map((rep) => rep.windowHr + 2))

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="controlled-threshold">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-headline text-foreground">{s.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.repClass[reading.repClass]}</p>
        </div>
        <StatusPill tone={VERDICT_TONE[reading.verdict]} className="mt-0.5 shrink-0">
          <span data-testid="controlled-verdict">{s.verdicts[reading.verdict]}</span>
        </StatusPill>
      </div>

      {reps.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={cn(ROW, 'text-caption uppercase tracking-[0.06em] text-muted-foreground')}>
            <span>{s.cols.rep}</span>
            <span className="truncate normal-case tracking-normal">{s.band(target, ceiling)}</span>
            <span className="text-right">{s.cols.pace}</span>
            <span className="text-right">{s.cols.hr}</span>
            <span className="text-right">{s.cols.peak}</span>
          </div>
          {reps.map((rep, index) => (
            <div key={index} className={cn(ROW, 'min-h-6 text-subhead')} data-testid="controlled-rep">
              <span className="tabular-nums text-foreground">{index + 1}</span>
              <HrTrack hr={rep.windowHr} target={target} ceiling={ceiling} low={low} high={high} />
              <span className="text-right tabular-nums text-[var(--text-2)]">{formatClock(rep.paceSecPerKm)}</span>
              <span className={cn('text-right font-bold tabular-nums', rep.windowHr > target ? 'text-[var(--warn)]' : 'text-foreground')}>
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
        {s.verdictDetail[reading.verdict]} {s.footnote(Math.round(windowStartSeconds / 60), `${formatClock(reading.guide.min)}–${formatClock(reading.guide.max)}`)}
      </p>
    </section>
  )
}
