'use client'

import { useState } from 'react'
import { CardTitle } from '@/components/ui/SectionLabel'
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

export function TrainingStatusDaysBar({ days }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)

  if (days.length === 0) return null

  const s = t.dashboard.trainingStatusDays
  const latest = days[days.length - 1]
  const groups = groupConsecutiveDays(days)
  const active = groups.find((group) => group.from === activeKey) ?? null

  // The finding, not the furniture: the longest rated stretch is the one fact a
  // reader takes from a 28-segment ribbon at a glance, and printing the two end
  // dates instead said nothing the segments did not already show.
  const dominant = groups
    .filter((group) => group.status !== null)
    .reduce((best, group) => (best === null || group.count > best.count ? group : best), null as DayGroup | null)

  return (
    <GlassSurface variant="card" className="p-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>{s.title}</CardTitle>
        {latest?.status && (
          <span className="text-xs font-semibold" style={{ color: TRAINING_STATUS_COLORS[latest.status] }}>
            {t.trainingStatus.status[latest.status]}
          </span>
        )}
      </div>

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

      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-micro text-muted-foreground">
        {active ? (
          <span className="text-foreground/80">{groupLabel(active)}</span>
        ) : (
          <>
            <span className="truncate">{s.window(days.length)}</span>
            {dominant?.status && (
              <span
                className="shrink-0 font-semibold tabular-nums"
                style={{ color: TRAINING_STATUS_COLORS[dominant.status] }}
              >
                {s.dominant(dominant.count, t.trainingStatus.status[dominant.status])}
              </span>
            )}
          </>
        )}
      </div>
    </GlassSurface>
  )
}
