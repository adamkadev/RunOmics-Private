'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { ActivitySummary } from '@/domain/activity/types'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { formatDuration, formatDate } from '@/lib/formatters'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { t } from '@/i18n'

interface Props {
  activity: ActivitySummary
  title?: string
  onClose: () => void
}

/** Bottom sheet glass quick-view, opened by tapping a day's session in the agenda week view. */
export function ActivitySheet({ activity, title, onClose }: Props) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  useScrollLock()

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        ref={trapRef}
        className="glass-sheet relative w-full animate-sheet-up rounded-t-card p-4 sm:max-w-sm sm:rounded-card-sm"
        style={{ ...sheetStyle, paddingBottom: 'max(16px, calc(var(--safe-bottom) + 8px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex justify-center sm:hidden" {...handleProps}>
          <div className="h-1 w-9 rounded-full bg-foreground/20" aria-hidden="true" />
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">
            {title || activity.description || t.activityTypes[activity.type]}
          </h2>
          <button
            onClick={close}
            aria-label={t.activity.shareCard.close}
            className="shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-foreground/10"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">{formatDate(activity.date)}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[11px] bg-foreground/[0.05] p-2.5">
            <div className="mb-0.5 text-micro text-muted-foreground">{t.plan.type}</div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ backgroundColor: ACTIVITY_TYPE_CONFIG[activity.type].chartColor }}
              />
              <span className="text-xs font-semibold text-foreground">{t.activityTypes[activity.type]}</span>
            </div>
          </div>
          <div className="rounded-[11px] bg-foreground/[0.05] p-2.5">
            <div className="mb-0.5 text-micro text-muted-foreground">{t.activities.sort.distance}</div>
            <div className="text-xs font-semibold text-foreground">
              {activity.distanceKm.toFixed(1)} {t.units.km}
            </div>
          </div>
          <div className="rounded-[11px] bg-foreground/[0.05] p-2.5">
            <div className="mb-0.5 text-micro text-muted-foreground">{t.activities.sort.duration}</div>
            <div className="text-xs font-semibold text-foreground">{formatDuration(activity.durationSeconds)}</div>
          </div>
          <div className="rounded-[11px] bg-foreground/[0.05] p-2.5">
            <div className="mb-0.5 text-micro text-muted-foreground">{t.activities.sort.avgHr}</div>
            <div className="text-xs font-semibold text-foreground">
              {activity.avgHeartRate ? `${activity.avgHeartRate} ${t.units.bpm}` : '-'}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={close}
            className="flex-1 rounded-xl border border-foreground/[0.12] bg-foreground/[0.07] py-2.5 text-center text-sm font-semibold text-foreground/70 transition-colors active:scale-[0.97]"
          >
            {t.activity.shareCard.close}
          </button>
          <Link
            href={`/activities/${activity.id}`}
            className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-bold text-accent-foreground shadow-[0_6px_16px_-6px_var(--accent)] transition-transform active:scale-[0.97]"
          >
            {t.plan.viewDetail}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}