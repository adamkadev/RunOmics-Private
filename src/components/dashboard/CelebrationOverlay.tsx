'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { Insight } from '@/lib/gemini'
import { CELEBRATION_WINDOW_DAYS } from '@/domain/ai/pbCelebrationInsight'
import { formatDuration, formatDistance } from '@/lib/formatters'
import { useHaptic } from '@/lib/useHaptic'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { CELEBRATION_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

const STORAGE_PREFIX = 'ro-celebration-seen:'

const [GREEN, AMBER, CYAN, PINK] = CELEBRATION_COLORS.confetti

const CONFETTI = [
  { top: '16%', left: '14%', color: GREEN, size: 8, rotate: '20deg' },
  { top: '24%', left: '80%', color: AMBER, size: 7, rotate: '-15deg' },
  { top: '34%', left: '22%', color: CYAN, size: 6, round: true },
  { top: '20%', left: '65%', color: PINK, size: 6, round: true },
  { bottom: '28%', left: '18%', color: AMBER, size: 7, rotate: '40deg' },
  { bottom: '34%', left: '84%', color: GREEN, size: 8, rotate: '-30deg' },
] as const

function isRecent(date: string): boolean {
  const days = (Date.now() - new Date(date + 'T00:00:00').getTime()) / 86_400_000
  return days >= 0 && days <= CELEBRATION_WINDOW_DAYS
}

export function CelebrationOverlay({ record, aiTake }: { record: RecordEntry | null; aiTake: Insight | null }) {
  const haptic = useHaptic()
  const trapRef = useFocusTrap<HTMLDivElement>()

  const eligible = !!(record?.activityId && record.date && record.seconds !== null && isRecent(record.date))
  const storageKey = eligible ? `${STORAGE_PREFIX}${record!.activityId}-${record!.key}` : null

  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !!storageKey && !window.localStorage.getItem(storageKey)
  )

  useEffect(() => {
    if (visible) haptic('celebration')
    // Fire once for the initial mount only - not on every `visible` toggle (e.g. dismiss).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible || !record || record.seconds === null) return null

  function dismiss() {
    if (storageKey) window.localStorage.setItem(storageKey, '1')
    setVisible(false)
  }

  const s = t.dashboard.celebration

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
      <div
        ref={trapRef}
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center text-white"
        style={{ background: 'var(--hero-gradient)' }}
      >
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="pointer-events-none absolute"
            style={{
              top: 'top' in c ? c.top : undefined,
              bottom: 'bottom' in c ? c.bottom : undefined,
              left: c.left,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: 'round' in c && c.round ? '50%' : 2,
              transform: 'rotate' in c ? `rotate(${c.rotate})` : undefined,
            }}
          />
        ))}

        <div
          className="mb-6 flex h-28 w-28 items-center justify-center rounded-full"
          style={{ background: CELEBRATION_COLORS.burst, boxShadow: CELEBRATION_COLORS.burstGlow }}
        >
          <Trophy size={52} className="text-white" />
        </div>

        <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-400">{s.eyebrow}</div>
        <div className="mb-1 text-2xl font-bold">
          {record.distanceKm ? `${formatDistance(record.distanceKm)} ${t.units.km}` : record.label}
        </div>
        <div className="text-4xl font-bold tabular-nums">{formatDuration(record.seconds)}</div>

        {aiTake && (
          <div className="mt-5 max-w-xs">
            <p className="text-base font-semibold leading-snug">{aiTake.headline}</p>
            <p className="mt-1 text-sm leading-snug text-white/70">{aiTake.body}</p>
          </div>
        )}

        <div className="mt-8 flex w-full max-w-xs gap-2.5">
          <button
            onClick={dismiss}
            className="flex-1 rounded-2xl bg-white/[0.12] py-3.5 text-sm font-semibold text-white active:scale-95"
          >
            {s.later}
          </button>
          <Link
            href={record.activityId ? `/activities/${record.activityId}` : '#'}
            onClick={dismiss}
            className="flex-[1.4] rounded-2xl bg-emerald-500 py-3.5 text-center text-sm font-bold text-emerald-950 active:scale-95"
          >
            {s.viewAndShare}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
