'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import { parseWorkoutStructure } from '@/domain/training/workoutStructure'
import { WorkoutStructureBars, WorkoutStepList } from './WorkoutStructure'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { t } from '@/i18n'

interface Props {
  workout: PlannedWorkout
  onClose: () => void
}

export function PlannedWorkoutSheet({ workout, onClose }: Props) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  const durationMin = workout.durationSecs ? Math.round(workout.durationSecs / 60) : null
  const distanceKm = workout.distanceM ? (workout.distanceM / 1000).toFixed(1) : null
  const structure = parseWorkoutStructure(workout.name, workout.durationSecs)
  const typeColor = workout.type
    ? ACTIVITY_TYPE_CONFIG[workout.type as ActivityType].chartColor
    : null
  const WorkoutIcon = ACTIVITY_TYPE_ICONS[workout.type as ActivityType]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={close}
      />

      <div
        ref={trapRef}
        className="relative w-full animate-sheet-up sm:max-w-sm sm:rounded-card-sm"
        style={{
          background: typeColor
            ? `linear-gradient(160deg, ${typeColor}1f 0%, rgba(14,22,18,.88) 55%)`
            : 'rgba(14,22,18,.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '22px 22px 20px 20px',
          border: `1px solid ${typeColor ? `${typeColor}44` : 'rgba(255,255,255,.08)'}`,
          ...sheetStyle,
        }}
      >
        {/* Handle - drag down to dismiss */}
        <div className="flex justify-center pt-3 pb-1" {...handleProps}>
          <div
            className="h-1 w-9 rounded-full"
            style={{ background: typeColor ? `${typeColor}55` : 'rgba(255,255,255,.2)' }}
          />
        </div>

        <div className="px-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 40px)' }}>
          <div className="mb-4 flex items-start gap-3">
            <span
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: typeColor ? `${typeColor}1a` : 'rgba(255,255,255,.07)' }}
            >
              <WorkoutIcon size={20} strokeWidth={2.2} style={{ color: typeColor ?? '#9ca3af' }} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-white">
                {workout.name}
              </h2>
            </div>
          </div>

          {/* Stats chips: time | type | duration | distance */}
          {(workout.scheduledTime || workout.type || durationMin || distanceKm) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {workout.scheduledTime && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  {workout.scheduledTime}
                </span>
              )}
              {workout.type && typeColor && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: `${typeColor}22`,
                    color: typeColor,
                    border: `1px solid ${typeColor}44`,
                  }}
                >
                  {t.activityTypes[workout.type as ActivityType]}
                </span>
              )}
              {durationMin && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  ~{durationMin} min
                </span>
              )}
              {distanceKm && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  {distanceKm} {t.units.km}
                </span>
              )}
            </div>
          )}

          {structure && (
            <div className="mb-4">
              <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-white/30">
                {t.plan.structure.title}
              </p>
              <WorkoutStructureBars steps={structure} className="mb-3 flex h-[26px] items-end gap-[3px]" />
              <WorkoutStepList steps={structure} type={workout.type as ActivityType | undefined} />
            </div>
          )}

          <p className="text-caption font-semibold uppercase tracking-wide text-white/30">
            {t.plan.planned}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
