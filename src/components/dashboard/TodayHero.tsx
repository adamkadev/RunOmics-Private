'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { PlannedWorkoutSheet } from '@/components/calendar/PlannedWorkoutSheet'
import { readinessTone } from '@/domain/training/readiness'
import { relativeTimeParts } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { useCountUp } from '@/lib/useCountUp'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const TONE_EYEBROW_CLASS = {
  go: 'bg-emerald-400/[0.18] text-emerald-300',
  caution: 'bg-amber-400/[0.18] text-amber-300',
  hold: 'bg-rose-400/[0.18] text-rose-300',
} as const

interface Props {
  status: TrainingStatus | null
  plannedWorkout: PlannedWorkout | null
  nextRace: UpcomingRace | null
  lastSyncedAt: string | null
}

function daysUntil(date: string): number {
  const today = new Date().toISOString().slice(0, 10)
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000)
}

function formatSyncedAgo(lastSyncedAt: string): string {
  const s = t.dashboard.syncStatus
  const { unit, value } = relativeTimeParts(lastSyncedAt)
  const relative =
    unit === 'now' ? s.justNow :
    unit === 'minutes' ? s.minutesAgo(value) :
    unit === 'hours' ? s.hoursAgo(value) :
    s.daysAgo(value)
  return s.synced(relative)
}

// Rules layer over the already-computed status/load - every clause reads an
// existing field (tsb, loadTrend, risk), nothing here is invented.
function readinessCopy(status: TrainingStatus): { headline: string; body: string } {
  const r = t.dashboard.todayHero.readiness
  const tsb = Math.round(status.tsb)
  switch (status.status) {
    case 'fresh':
      return { headline: r.fresh.headline, body: r.fresh.body(tsb) }
    case 'productive':
      return {
        headline: r.productive.headline,
        body: r.productive.body(t.trainingStatus.loadTrend[status.loadTrend], status.risk),
      }
    case 'recovery':
      return { headline: r.recovery.headline, body: r.recovery.body }
    case 'detraining':
      return { headline: r.detraining.headline, body: r.detraining.body }
    case 'overreaching':
      return { headline: r.overreaching.headline, body: r.overreaching.body(tsb) }
  }
}

// Pure display + a rules-based readiness verdict over already-computed status/load data.
export function TodayHero({ status, plannedWorkout, nextRace, lastSyncedAt }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const animatedTsb = useCountUp(status?.tsb ?? 0)
  const animatedDaysToRace = useCountUp(nextRace ? daysUntil(nextRace.date) : 0)

  if (!status && !plannedWorkout && !nextRace) return null

  const s = t.dashboard.todayHero
  const isNegativeTsb = (status?.tsb ?? 0) < 0
  const formValueClass = isNegativeTsb ? STATUS.warning.text : STATUS.success.text
  const formValue = status ? `${status.tsb >= 0 ? '+' : ''}${Math.round(animatedTsb)}` : null
  const tone = status ? readinessTone(status.status, status.risk) : null
  const verdict = status ? readinessCopy(status) : null

  return (
    <div
      className="rounded-card border border-white/[0.06] p-5 text-white shadow-[0_10px_26px_-6px_rgba(0,0,0,0.35)]"
      style={{ background: 'var(--hero-gradient)' }}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', tone ? TONE_EYEBROW_CLASS[tone] : TONE_EYEBROW_CLASS.go)}>
          {tone ? s.eyebrowByTone[tone] : s.eyebrowByTone.go}
        </span>
        {lastSyncedAt && (
          <span className="text-[11px] text-white/60">{formatSyncedAgo(lastSyncedAt)}</span>
        )}
      </div>

      {status && (
        <div className="mb-1 flex items-end gap-2">
          <span className={cn('text-5xl font-extrabold leading-none tabular-nums', formValueClass)}>
            {formValue}
          </span>
          <span className="pb-1 text-[13px] text-white/70">
            {t.trainingStatus.status[status.status]}
          </span>
        </div>
      )}

      {verdict && (
        <div className="mt-2">
          <div className="text-[15px] font-semibold leading-snug">{verdict.headline}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-white/70">{verdict.body}</div>
        </div>
      )}

      {(plannedWorkout || nextRace) && (
        <>
          <div className="my-3.5 h-px bg-white/[0.12]" />
          <div className="flex gap-4">
            {plannedWorkout && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex flex-1 items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5 text-left transition-colors active:opacity-80"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">
                    {s.plannedSession}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold">{plannedWorkout.name}</div>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.12] px-2.5 py-1.5 text-[11px] font-semibold">
                  {s.sessionCta}
                  <ChevronRight size={13} strokeWidth={2.5} />
                </span>
              </button>
            )}
            {nextRace && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/50">{s.race}</div>
                <div className="mt-0.5 text-sm font-semibold">{s.daysToRace(Math.round(animatedDaysToRace))}</div>
              </div>
            )}
          </div>
        </>
      )}

      {sheetOpen && plannedWorkout && (
        <PlannedWorkoutSheet workout={plannedWorkout} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
