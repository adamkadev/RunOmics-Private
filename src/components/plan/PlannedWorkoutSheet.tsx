'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityType, PlannedWorkout } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from '@/domain/activity/types'
import { parseWorkoutStructure } from '@/domain/training/workoutStructure'
import { formatDurationWords } from '@/lib/formatters'
import { WorkoutStructureBars, WorkoutStepList } from './WorkoutStructure'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { WORKOUT_SHEET_COLORS as SHEET } from '@/lib/colors'
import { withAlpha } from '@/lib/palette'
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

  const durationLabel = workout.durationSecs ? formatDurationWords(workout.durationSecs) : null
  const distanceKm = workout.distanceM ? (workout.distanceM / 1000).toFixed(1) : null
  const structure = workout.steps ?? parseWorkoutStructure(workout.name, workout.durationSecs)
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
            ? `linear-gradient(160deg, ${withAlpha(typeColor, SHEET.tint.fill)} 0%, ${SHEET.baseTinted} 55%)`
            : SHEET.base,
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRadius: '22px 22px 20px 20px',
          border: `1px solid ${typeColor ? withAlpha(typeColor, SHEET.tint.border) : SHEET.border}`,
          ...sheetStyle,
        }}
      >
        {/* Handle - drag down to dismiss */}
        <div className="flex justify-center pt-3 pb-1" {...handleProps}>
          <div
            className="h-1 w-9 rounded-full"
            style={{ background: typeColor ? withAlpha(typeColor, SHEET.tint.handle) : SHEET.handle }}
          />
        </div>

        <div className="px-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 40px)' }}>
          <div className="mb-4 flex items-start gap-3">
            <span
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: typeColor ? withAlpha(typeColor, SHEET.tint.iconWell) : SHEET.iconWell }}
            >
              <WorkoutIcon size={20} strokeWidth={2.2} style={{ color: typeColor ?? SHEET.iconFallback }} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-white">
                {workout.name}
              </h2>
            </div>
          </div>

          {(workout.scheduledTime || workout.type || durationLabel || distanceKm) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {workout.scheduledTime && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  {t.plan.timeOfDay[workout.scheduledTime]}
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
              {durationLabel && (
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">
                  {durationLabel}
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
              {/* A single continuous block has no interval shape to show. */}
              {structure.length > 1 && (
                <WorkoutStructureBars steps={structure} className="mb-3 flex h-[26px] items-end gap-[3px]" />
              )}
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
