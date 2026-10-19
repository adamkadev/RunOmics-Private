import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { verdictTone, type ReadinessTone } from '@/domain/training/readiness'
import { cardClass } from '@/components/ui/Card'
import { VerdictEyebrow, type VerdictTone } from '@/components/ui/Verdict'
import { deltaTone, DELTA_TONE_COLOR } from '@/lib/deltaTone'
import { formatDecimal, formatDelta, formatRanKm } from '@/lib/formatters'
import { addDays, isoDate } from '@/lib/calendarDate'
import type { Insight } from '@/lib/gemini'
import { FormDial } from './FormDial'
import { t } from '@/i18n'

type Status = NonNullable<TrainingStatusDayBar['status']>

const VERDICT_TONE: Record<ReadinessTone, VerdictTone> = {
  go: 'pos',
  build: 'neutral',
  caution: 'warn',
  hold: 'warn',
}

export function latestRatedStatus(days: TrainingStatusDayBar[]): Status | null {
  return [...days].reverse().find((d) => d.status)?.status ?? null
}

/** Km and runs over the last seven days, today included. */
export function lastSevenDays(activities: readonly { date: string; distanceKm: number }[], today: string): { km: number; runs: number } {
  const from = isoDate(addDays(new Date(`${today}T00:00:00`), -6))
  const recent = activities.filter((a) => a.date >= from && a.date <= today)
  return { km: recent.reduce((sum, a) => sum + a.distanceKm, 0), runs: recent.length }
}

function Cell({ label, value, delta }: { label: string; value: ReactNode; delta?: { text: string; color: string } }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-1">
        <span className="text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-foreground">{value}</span>
        {delta && (
          <span data-testid="readiness-delta" className="text-xs font-semibold tabular-nums" style={{ color: delta.color }}>
            {delta.text}
          </span>
        )}
      </span>
    </div>
  )
}

export function ReadinessCard({
  status,
  watchStatus = null,
  verdict = null,
  lastWeek,
}: {
  status: TrainingStatus | null
  watchStatus?: Status | null
  verdict?: Insight | null
  /** The last seven days, shown in Garmin's place when the watch reports no training status (a Forerunner 55). */
  lastWeek: { km: number; runs: number }
}) {
  if (!status) return null

  const s = t.dashboard.readiness
  const form = Math.round(status.tsbNow)
  const tone = verdictTone(status)
  const fitness = deltaTone('fitness', status.ctlDeltaShown, { value: status.ctl })
  const fatigue = deltaTone('fatigue', status.atlDelta, { value: status.atl })

  return (
    <Link href="/analytics" aria-label={s.open} className="block active:scale-[0.99]" data-testid="readiness-card-link">
      <section className={cardClass({ padding: 'lg', className: 'flex flex-col gap-4' })} data-testid="readiness-card">
        <div className="flex items-center gap-3.5">
          <FormDial form={form} />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <VerdictEyebrow tone={VERDICT_TONE[tone]}>{s.eyebrowByTone[tone]}</VerdictEyebrow>
                <span className="text-sm leading-snug text-[var(--text-2)] text-pretty">{s.lineByTone[tone]}</span>
              </div>
              <ChevronRight size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Cell
                label={s.ctl}
                value={Math.round(status.ctl)}
                delta={{ text: formatDelta(Math.round(status.ctlDeltaShown)), color: DELTA_TONE_COLOR[fitness] }}
              />
              <Cell
                label={s.atl}
                value={Math.round(status.atl)}
                delta={{ text: formatDelta(Math.round(status.atlDelta)), color: DELTA_TONE_COLOR[fatigue] }}
              />
              <Cell label={s.acwr} value={status.acwr === null ? s.noValue : s.acwrValue(formatDecimal(status.acwr, 2))} />
              {watchStatus ? (
                <Cell
                  label={s.garmin}
                  value={<span className="text-[17px] leading-snug break-words">{t.trainingStatus.status[watchStatus]}</span>}
                />
              ) : (
                <Cell
                  label={s.lastSevenDays}
                  value={
                    <span data-testid="readiness-last-week">
                      {formatRanKm(lastWeek.km)}
                      <span className="ml-1 text-[13px] font-normal tracking-normal text-muted-foreground">{t.units.km}</span>
                    </span>
                  }
                  delta={{ text: t.activities.weekLine.runs(lastWeek.runs), color: 'var(--muted-foreground)' }}
                />
              )}
            </div>
          </div>
        </div>

        {verdict && (
          <div className="flex flex-col gap-1 border-t border-border pt-3.5" data-testid="readiness-verdict">
            <p className="text-[17px] font-semibold leading-snug text-foreground [text-wrap:pretty]">{verdict.headline}</p>
            {verdict.body && <p className="text-sm leading-normal text-[var(--text-2)] [text-wrap:pretty]">{verdict.body}</p>}
          </div>
        )}
      </section>
    </Link>
  )
}
