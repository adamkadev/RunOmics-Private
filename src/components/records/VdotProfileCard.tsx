import type { VdotProfile } from '@/application/usecases/GetVdotProfile'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDecimal, formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const STEP = 5
const NEAR_BEST = 2

function vdotAxis(vdots: readonly number[]): { min: number; max: number; ticks: number[] } {
  const min = Math.floor((Math.min(...vdots) - 2) / STEP) * STEP
  const max = Math.ceil((Math.max(...vdots) + 2) / STEP) * STEP
  const ticks: number[] = []
  for (let v = min; v <= max; v += STEP) ticks.push(v)
  return { min, max, ticks }
}

export function VdotProfileCard({ profile }: { profile: VdotProfile }) {
  const v = t.records.vdotProfile
  const label = (key: string) => t.records.distances[key] ?? key
  const axis = vdotAxis(profile.rows.map((r) => r.vdot))
  const at = (vdot: number) => `${((vdot - axis.min) / (axis.max - axis.min)) * 100}%`
  const read = profile.lead === 'speed' ? v.leadSpeed(profile.gap) : profile.lead === 'endurance' ? v.leadEndurance(profile.gap) : v.even
  const summary = profile.rows.map((r) => `${label(r.key)} ${formatDecimal(r.vdot, 1)}`).join(', ')

  return (
    <section className={cardClass()} data-testid="vdot-profile">
      <h2 className="text-[15px] font-semibold text-foreground">{v.title}</h2>
      <div role="img" aria-label={v.aria(summary)} className="mt-3 grid grid-cols-[3.75rem_minmax(0,1fr)_2.5rem] items-center gap-x-2.5 gap-y-2.5">
        {profile.rows.map((r) => {
          const tone = profile.best.vdot - r.vdot <= NEAR_BEST ? 'near' : 'trailing'
          return (
            <div key={r.key} className="contents" data-testid="vdot-row" data-tone={tone}>
              <span className="min-w-0 text-[13.5px] leading-tight text-foreground">
                {label(r.key)}
                {r.date && <span className="block text-[11px] text-muted-foreground">{formatDate(r.date, { precision: 'month', year: 'always' })}</span>}
              </span>
              <span aria-hidden className="relative block h-2 rounded-full bg-[var(--track)]">
                <span
                  className={cn('absolute inset-y-0 left-0 rounded-full', tone === 'near' ? 'bg-[var(--pos)]' : 'shadow-[inset_0_0_0_1.5px_var(--warn)]')}
                  style={{ width: at(r.vdot) }}
                />
              </span>
              <span className="text-right text-[13.5px] font-bold tabular-nums text-foreground">{formatDecimal(r.vdot, 1)}</span>
            </div>
          )
        })}
        <span aria-hidden />
        <span aria-hidden className="flex justify-between text-[11px] tabular-nums text-[var(--axis-text)]">
          {axis.ticks.map((tick) => <span key={tick}>{tick}</span>)}
        </span>
        <span aria-hidden />
      </div>

      <p className="mt-3.5 text-[13.5px] leading-normal text-foreground" data-testid="vdot-read">{read}</p>
      {profile.staleTrailing.length > 0 && (
        <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="vdot-stale">
          {v.stale(profile.staleTrailing.map((r) => label(r.key)).join(', '))}
        </p>
      )}

      {profile.equivalents.length > 0 && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3.5 gap-y-1.5 border-t border-border pt-3 text-[13px] tabular-nums">
          <span className={cn(EYEBROW_CLASS, 'tracking-normal text-muted-foreground')}>{v.worthTitle(label(profile.anchor.key))}</span>
          <span className={cn(EYEBROW_CLASS, 'text-right tracking-normal text-muted-foreground')}>{v.now}</span>
          <span className={cn(EYEBROW_CLASS, 'text-right tracking-normal text-muted-foreground')}>{v.worth}</span>
          {profile.equivalents.map((e) => (
            <div key={e.key} className="contents" data-testid="vdot-equivalent">
              <span className="text-foreground">{label(e.key)}</span>
              <span className="text-right text-muted-foreground">{e.seconds === null ? '–' : formatDuration(e.seconds)}</span>
              <span className="text-right font-bold text-[var(--pos)]">{formatDuration(e.worthSeconds)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[11.5px] text-muted-foreground">{v.note}</p>
    </section>
  )
}
