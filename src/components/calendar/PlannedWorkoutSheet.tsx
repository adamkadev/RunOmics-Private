'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { t } from '@/i18n'

interface Props {
  workout: PlannedWorkout
  onClose: () => void
}

export function PlannedWorkoutSheet({ workout, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const durationMin = workout.durationSecs ? Math.round(workout.durationSecs / 60) : null
  const distanceKm = workout.distanceM ? (workout.distanceM / 1000).toFixed(1) : null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full"
        style={{
          background: 'rgba(14,22,18,.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '22px 22px 20px 20px',
          border: '1px solid rgba(255,255,255,.08)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-1 w-9 rounded-full"
            style={{ background: 'rgba(255,255,255,.2)' }}
          />
        </div>

        <div className="px-5 pb-10 pt-3">
          {/* Header */}
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f1761f" strokeWidth="2.2">
                <path d="M13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-5 6l2-2 2 1 3-2M7 17l2-3 3 1 2-2" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-white">
                {workout.name}
              </h2>
              {workout.scheduledTime && (
                <p className="mt-0.5 text-sm text-white/50">{workout.scheduledTime}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          {(workout.type || distanceKm || durationMin) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {workout.type && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: `${ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].dotColor}22`,
                    color: ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].dotColor,
                    border: `1px solid ${ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].dotColor}44`,
                  }}
                >
                  {t.activityTypes[workout.type as ActivityType]}
                </span>
              )}
              {distanceKm && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  {distanceKm} {t.units.km}
                </span>
              )}
              {durationMin && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  ~{durationMin} min
                </span>
              )}
            </div>
          )}

          {/* Label */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
            {t.calendar.planned}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
