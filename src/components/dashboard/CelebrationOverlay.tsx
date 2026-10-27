'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { ReturnMilestone } from '@/domain/training/returnProgress'
import type { Insight } from '@/lib/gemini'
import { isRecentRecord } from '@/domain/ai/celebrationWindow'
import { formatDuration, formatDistance } from '@/lib/formatters'
import { useHaptic } from '@/lib/useHaptic'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useMounted } from '@/lib/useMounted'
import { CELEBRATION_COLORS } from '@/lib/colors'
import { pushPaths } from '@/lib/pushLinks'
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



interface Celebrated {
  storageKey: string
  eyebrow: string
  title: string
  value: string | null
  href: string
  isRecord: boolean
}

function recordCelebration(record: RecordEntry | null, now: Date): Celebrated | null {
  if (!record?.activityId || !record.date || record.seconds === null || !isRecentRecord(record.date, now)) return null
  return {
    storageKey: `${STORAGE_PREFIX}${record.activityId}-${record.key}`,
    eyebrow: t.dashboard.celebration.eyebrow,
    title: record.distanceKm ? `${formatDistance(record.distanceKm)} ${t.units.km}` : record.label,
    value: formatDuration(record.seconds),
    href: `/activities/${record.activityId}`,
    isRecord: true,
  }
}

function milestoneCelebration(milestone: ReturnMilestone | null, now: Date): Celebrated | null {
  if (!milestone || !isRecentRecord(milestone.date, now)) return null
  return {
    storageKey: `${STORAGE_PREFIX}return-${milestone.key}-${milestone.date}`,
    eyebrow: t.returnProgress.celebration,
    title: t.returnProgress.milestones[milestone.key],
    value: null,
    href: milestone.activityId ? `/activities/${milestone.activityId}` : pushPaths.comeback,
    isRecord: false,
  }
}

/** A record and a return milestone on the same days: the record first, the milestone once it is dismissed. */
export function CelebrationOverlay({
  record,
  milestone = null,
  aiTake,
}: {
  record: RecordEntry | null
  milestone?: ReturnMilestone | null
  aiTake: Insight | null
}) {
  const haptic = useHaptic()
  const trapRef = useFocusTrap<HTMLDivElement>()

  // Decided after mount: it depends on the reader's clock and this browser's localStorage, which the server knows neither of.
  const mounted = useMounted()
  const [dismissed, setDismissed] = useState<string[]>([])
  const markSeen = (key: string | null) => {
    if (!key) return
    window.localStorage.setItem(key, '1')
    setDismissed((keys) => [...keys, key])
  }
  const now = new Date()
  const item = mounted
    ? [recordCelebration(record, now), milestoneCelebration(milestone, now)].find(
        (candidate): candidate is Celebrated =>
          candidate !== null && !dismissed.includes(candidate.storageKey) && !window.localStorage.getItem(candidate.storageKey),
      ) ?? null
    : null
  const shownKey = item?.storageKey ?? null
  const titleId = useId()

  useEffect(() => {
    if (shownKey) haptic('celebration')
  }, [shownKey, haptic])

  useEffect(() => {
    if (!shownKey) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') markSeen(shownKey)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shownKey])

  if (!item) return null

  const dismiss = () => markSeen(item.storageKey)

  const s = t.dashboard.celebration

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-eyebrow ${titleId}`}>
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

        <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent-text" id={`${titleId}-eyebrow`}>{item.eyebrow}</div>
        <div className="mb-1 text-2xl font-bold" id={titleId}>{item.title}</div>
        {item.value && <div className="text-4xl font-bold tabular-nums">{item.value}</div>}

        {aiTake && item.isRecord && (
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
            href={item.href}
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
