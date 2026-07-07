'use client'

import { useState } from 'react'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { PlannedWorkoutSheet } from '@/components/calendar/PlannedWorkoutSheet'
import { relativeTimeParts } from '@/lib/formatters'
import { STATUS } from '@/lib/statusColors'
import { useCountUp } from '@/lib/useCountUp'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

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

// Pure display aggregation of already-computed dashboard data - never a training recommendation.
export function TodayHero({ status, plannedWorkout, nextRace, lastSyncedAt }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const animatedTsb = useCountUp(status?.tsb ?? 0)
  const animatedDaysToRace = useCountUp(nextRace ? daysUntil(nextRace.date) : 0)

  if (!status && !plannedWorkout && !nextRace) return null

  const s = t.dashboard.todayHero
  const isNegativeTsb = (status?.tsb ?? 0) < 0
  const formValueClass = isNegativeTsb ? STATUS.warning.text : STATUS.success.text
  const formValue = status ? `${status.tsb >= 0 ? '+' : ''}${Math.round(animatedTsb)}` : null

  return (
    <div
      className="rounded-card border border-white/[0.06] p-5 text-white shadow-[0_10px_26px_-6px_rgba(0,0,0,0.35)]"
      style={{ background: 'var(--hero-gradient)' }}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span className="rounded-full bg-emerald-400/[0.18] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          {s.eyebrow}
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

      {(plannedWorkout || nextRace) && (
        <>
          <div className="my-3.5 h-px bg-white/[0.12]" />
          <div className="flex gap-4">
            {plannedWorkout && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex-1 text-left active:opacity-80"
              >
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  {s.plannedSession}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{plannedWorkout.name}</div>
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
