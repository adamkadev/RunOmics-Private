'use client'

import { useState } from 'react'
import type { TrainingStatusDayBar } from '@/application/usecases/GetTrainingStatusDaysBar'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { TRAINING_STATUS_COLORS } from '@/lib/colors'
import { formatDate, formatDateRange, type DateFormatOptions } from '@/lib/formatters'
import { t } from '@/i18n'

interface Props {
  days: TrainingStatusDayBar[]
}

const EMPTY_SEGMENT = 'var(--track-on-dark)'

interface DayGroup {
  status: TrainingStatusDayBar['status']
  from: string
  to: string
  count: number
}

function groupConsecutiveDays(days: TrainingStatusDayBar[]): DayGroup[] {
  const groups: DayGroup[] = []

  for (const day of days) {
    const last = groups[groups.length - 1]
    if (last && last.status === day.status) {
      last.count += 1
      last.to = day.date
      continue
    }
    groups.push({ status: day.status, from: day.date, to: day.date, count: 1 })
  }

  return groups
}

// A fortnight of segments, so every date here is a caption: no weekday, and
// the dash between the two ends of a group is Intl's, not one we type.
const DENSE: DateFormatOptions = { style: 'bare' }

function groupLabel(group: DayGroup): string {
  const s = t.dashboard.trainingStatusDays
  const status = group.status ? t.trainingStatus.status[group.status] : s.noReading
  const range =
    group.count === 1 ? formatDate(group.from, DENSE) : formatDateRange(group.from, group.to, DENSE)
  return `${status} · ${range}`
}

const COMPOSITION_MAX = 1
const FOOTER_INK = '#b9c4cf'
const EYEBROW_INK = '#8d99a6'

type RatedStatus = NonNullable<TrainingStatusDayBar['status']>

function statusComposition(days: TrainingStatusDayBar[]): { status: RatedStatus; count: number }[] {
  const counts = new Map<RatedStatus, number>()
  for (const day of days) {
    if (!day.status) continue
    counts.set(day.status, (counts.get(day.status) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))
    .slice(0, COMPOSITION_MAX)
}

export function TrainingStatusDaysBar({ days }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)

  if (days.length === 0) return null

  const s = t.dashboard.trainingStatusDays
  const latest = days[days.length - 1]
  const groups = groupConsecutiveDays(days)
  const active = groups.find((group) => group.from === activeKey) ?? null

  const composition = statusComposition(days)

  return (
    <GlassSurface variant="card" className="p-4">
      <p
        className="font-bold uppercase leading-tight"
        style={{ fontSize: '10.5px', letterSpacing: '0.16em', color: EYEBROW_INK }}
      >
        {s.titleToday(s.title)}
      </p>
      {latest?.status && (
        <p
          className="mt-1 font-display font-bold leading-tight tracking-tight"
          style={{ fontSize: '24px', color: TRAINING_STATUS_COLORS[latest.status] }}
        >
          {t.trainingStatus.status[latest.status]}
        </p>
      )}

      <div className="mt-2.5 flex h-4 overflow-hidden rounded-sm">
        {groups.map((group) => (
          <button
            key={group.from}
            type="button"
            className="h-full cursor-pointer transition-opacity"
            style={{
              flexGrow: group.count,
              flexBasis: 0,
              background: group.status ? TRAINING_STATUS_COLORS[group.status] : EMPTY_SEGMENT,
              opacity: active && active.from !== group.from ? 0.4 : 1,
            }}
            aria-label={groupLabel(group)}
            onClick={() => setActiveKey(group.from)}
            onMouseEnter={() => setActiveKey(group.from)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(group.from)}
            onBlur={() => setActiveKey(null)}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2" style={{ fontSize: '12.5px' }}>
        {active ? (
          <span className="text-foreground/80">{groupLabel(active)}</span>
        ) : (
          <>
            <span className="min-w-0 truncate" style={{ color: EYEBROW_INK }}>
              {s.window(days.length)} · {s.tapHint}
            </span>
            {composition[0] && (
              <span className="shrink-0 font-normal tabular-nums" style={{ color: FOOTER_INK }}>
                {s.dominant(composition[0].count, t.trainingStatus.status[composition[0].status])}
              </span>
            )}
          </>
        )}
      </div>
    </GlassSurface>
  )
}
