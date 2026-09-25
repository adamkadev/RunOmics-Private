'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityType } from '@/domain/activity/types'
import { activityTypeStyle } from '@/components/activity/activityTypeStyle'
import { Pill } from '@/components/ui/Pill'
import { StatusPill } from '@/components/ui/StatusPill'
import { formatPlanDuration, type PlanWorkoutView } from './planWorkoutView'
import { WorkoutStructureBars, WorkoutStepList } from './WorkoutStructure'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { WORKOUT_SHEET_COLORS as SHEET } from '@/lib/colors'
import { withAlpha } from '@/lib/palette'
import { t } from '@/i18n'

interface Props {
  workout: PlanWorkoutView
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

  const durationLabel = formatPlanDuration(workout.duration)
  const distanceKm = workout.distanceM ? (workout.distanceM / 1000).toFixed(1) : null
  const structure = workout.structure
  const typeColor = workout.type ? activityTypeStyle(workout.type).chartColor : null
  // A Garmin plan can carry no type, or one this app does not know yet: the
  // icon lookup used to come back undefined and take the sheet down with it.
  const WorkoutIcon = activityTypeStyle(workout.type).icon

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
              <WorkoutIcon size={20} strokeWidth={2.2} style={{ color: SHEET.iconFallback }} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-white">
                {workout.title}
              </h2>
            </div>
          </div>

          {(workout.scheduledTime || workout.type || durationLabel || distanceKm) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {workout.scheduledTime && (
                <Pill variant="onDark">{t.plan.timeOfDay[workout.scheduledTime]}</Pill>
              )}
              {workout.type && typeColor && (
                // The type chip is the one chip in the row where the hue is the
                // message and not decoration, so it keeps the identity colour
                // as ink over the shared geometry.
                <Pill
                  variant="onDark"
                  style={{
                    background: withAlpha(typeColor, SHEET.tint.chipFill),
                    color: typeColor,
                    borderColor: withAlpha(typeColor, SHEET.tint.border),
                  }}
                >
                  {t.activityTypes[workout.type as ActivityType]}
                </Pill>
              )}
              {durationLabel && <Pill variant="onDark">{durationLabel}</Pill>}
              {distanceKm && <Pill variant="onDark">{distanceKm} {t.units.km}</Pill>}
            </div>
          )}

          {workout.target && (
            <p className="mb-3 text-sm font-semibold tabular-nums text-white/85">{workout.target}</p>
          )}

          {(workout.description || workout.notes.length > 0) && (
            <div className="mb-4 space-y-1.5">
              {workout.description && (
                <p className="text-xs leading-relaxed text-white/60">{workout.description}</p>
              )}
              {workout.notes.map((note, i) => (
                <p key={i} className="text-xs leading-relaxed text-white/60">{note}</p>
              ))}
            </div>
          )}

          {structure && (
            <div className="mb-4">
              <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-white/30">
                {t.plan.structure.title}
              </p>
              {structure.length > 1 && (
                <WorkoutStructureBars steps={structure} className="mb-3 flex h-[26px] items-end gap-[3px]" />
              )}
              <WorkoutStepList steps={structure} type={workout.type as ActivityType | undefined} />
            </div>
          )}

          {workout.alert && (
            <div className="mb-3">
              <StatusPill tone="amber">{workout.alert}</StatusPill>
            </div>
          )}

          <p className="text-caption font-semibold uppercase tracking-wide text-white/30">
            {workout.statusLabel}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
