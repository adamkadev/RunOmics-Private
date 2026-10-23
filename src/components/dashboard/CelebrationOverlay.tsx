'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { Insight } from '@/lib/gemini'
import { isRecentRecord } from '@/domain/ai/celebrationWindow'
import { formatDuration, formatDistance } from '@/lib/formatters'
import { useHaptic } from '@/lib/useHaptic'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useMounted } from '@/lib/useMounted'
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



export function CelebrationOverlay({ record, aiTake }: { record: RecordEntry | null; aiTake: Insight | null }) {
  const haptic = useHaptic()
  const trapRef = useFocusTrap<HTMLDivElement>()

  // Decided after mount: it depends on the reader's clock and this browser's localStorage, which the server knows neither of.
  const mounted = useMounted()
  const [dismissed, setDismissed] = useState(false)
  const storageKey =
    mounted && record?.activityId && record.date && record.seconds !== null && isRecentRecord(record.date, new Date())
      ? `${STORAGE_PREFIX}${record.activityId}-${record.key}`
      : null
  const visible = !dismissed && storageKey !== null && !window.localStorage.getItem(storageKey)

  useEffect(() => {
    // visible only ever turns true once (dismissing is final), so this buzzes once.
    if (visible) haptic('celebration')
  }, [visible, haptic])

  if (!visible || !record || record.seconds === null) return null

  function dismiss() {
    if (storageKey) window.localStorage.setItem(storageKey, '1')
    setDismissed(true)
  }

  const s = t.dashboard.celebration

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
      <div
        ref={trapRef}
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground"
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
          className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-accent"
        >
          <Trophy size={52} className="text-accent-foreground" />
        </div>

        <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-text">{s.eyebrow}</div>
        <div className="mb-1 text-2xl font-bold">
          {record.distanceKm ? `${formatDistance(record.distanceKm)} ${t.units.km}` : record.label}
        </div>
        <div className="text-4xl font-bold tabular-nums">{formatDuration(record.seconds)}</div>

        {aiTake && (
          <div className="mt-5 max-w-xs">
            <p className="text-base font-semibold leading-snug">{aiTake.headline}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{aiTake.body}</p>
          </div>
        )}

        <div className="mt-8 flex w-full max-w-xs gap-2.5">
          <button
            onClick={dismiss}
            className="flex-1 rounded-2xl bg-[var(--segmented-track)] py-3.5 text-sm font-semibold text-foreground active:scale-95"
          >
            {s.later}
          </button>
          <Link
            href={record.activityId ? `/activities/${record.activityId}` : '#'}
            onClick={dismiss}
            className="flex-[1.4] rounded-2xl bg-accent py-3.5 text-center text-sm font-bold text-accent-foreground active:scale-95"
          >
            {s.viewAndShare}
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
