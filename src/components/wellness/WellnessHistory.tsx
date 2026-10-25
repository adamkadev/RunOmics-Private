'use client'

import { useEffect, useState } from 'react'
import {
  CHECK_IN_SCORES,
  checkInDays,
  niggleEpisodes,
  PAIN_STOP,
  shiftDate,
  type CheckIn,
  type NiggleEpisode,
} from '@/domain/wellness/checkIn'
import { appTodayIso } from '@/lib/calendarDate'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { formatDate, formatDateRange } from '@/lib/formatters'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { readCheckInsSince } from '@/lib/wellness'
import { cardClass } from '@/components/ui/Card'
import { t } from '@/i18n'
import { niggleLabel } from './checkInWords'

export const STRIP_WEEKS = 4
export const NIGGLE_WEEKS = 12

/** Accent-independent: how a morning went is a reading, like the readiness tone. */
const SCORE_FILL = [
  'var(--neg)',
  'var(--warn)',
  'color-mix(in srgb, var(--foreground) 25%, transparent)',
  'color-mix(in srgb, var(--pos) 55%, transparent)',
  'var(--pos)',
]
const EMPTY_FILL = 'var(--fill-3)'
const TRAVEL_FILL = 'color-mix(in srgb, var(--foreground) 45%, transparent)'

function painFill(pain: number): string {
  return pain >= PAIN_STOP ? 'var(--neg)' : `color-mix(in srgb, var(--warn) ${35 + pain * 10}%, transparent)`
}

type Row = { key: string; label: string; fill: (entry: CheckIn | null) => string }

const ROWS: Row[] = [
  ...CHECK_IN_SCORES.map((field) => ({
    key: field,
    label: t.wellness.checkIn.scores[field].label,
    fill: (entry: CheckIn | null) => {
      const value = entry?.[field]
      return value === undefined ? EMPTY_FILL : SCORE_FILL[value - 1]!
    },
  })),
  {
    key: 'niggle',
    label: t.wellness.history.niggleRow,
    fill: (entry) => (entry?.niggle ? painFill(entry.niggle.pain) : EMPTY_FILL),
  },
  {
    key: 'flags',
    label: t.wellness.history.flagsRow,
    fill: (entry) => (entry?.ill ? 'var(--neg)' : entry?.travel ? TRAVEL_FILL : EMPTY_FILL),
  },
]

function weeksOf<T>(days: T[]): T[][] {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7))
}

function Swatch({ fill, label }: { fill: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="h-2.5 w-1.5 rounded-[2px]" style={{ background: fill }} />
      {label}
    </span>
  )
}

function EpisodeRow({ episode, today }: { episode: NiggleEpisode; today: string }) {
  const h = t.wellness.history
  const ongoing = episode.to >= shiftDate(today, -1)
  const when = episode.from === episode.to ? formatDate(episode.from, { style: 'bare' }) : formatDateRange(episode.from, episode.to, { style: 'bare' })
  const detail = [when, h.days(episode.daysReported), episode.daysChangingRun > 0 ? h.changedRuns(episode.daysChangingRun) : null, ongoing ? h.ongoing : null]
  return (
    <li className="flex items-start gap-2.5 border-t border-border py-2" data-testid="niggle-episode">
      <span aria-hidden className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: painFill(episode.peakPain) }} />
      <span className="min-w-0 flex-1">
        <span className="block text-subhead font-medium text-foreground">{niggleLabel(episode)}</span>
        <span className="block text-footnote text-muted-foreground">{detail.filter(Boolean).join(' · ')}</span>
      </span>
      <span className="shrink-0 text-footnote font-semibold tabular-nums text-foreground">{h.peak(t.wellness.pain(episode.peakPain))}</span>
    </li>
  )
}

export function WellnessHistoryView({ entries, today }: { entries: ReadonlyMap<string, CheckIn>; today: string }) {
  const h = t.wellness.history
  const days = checkInDays(entries, today, STRIP_WEEKS * 7)
  const answered = days.filter((day) => day.entry !== null).length
  const episodes = niggleEpisodes(entries)

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3.5 rounded-[18px]' })} data-testid="wellness-history">
      <div>
        <h2 className="text-headline text-foreground">{h.title}</h2>
        <p className="mt-0.5 text-footnote text-muted-foreground">{h.subtitle(STRIP_WEEKS)}</p>
      </div>

      {entries.size === 0 ? (
        <p className="text-[13px] text-muted-foreground">{h.empty}</p>
      ) : (
        <>
          <div role="img" aria-label={h.stripLabel(answered, days.length)} className="flex flex-col gap-1.5" data-testid="wellness-strip">
            {ROWS.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <span aria-hidden className="w-[76px] shrink-0 truncate text-[11px] text-muted-foreground">{row.label}</span>
                <div className="flex min-w-0 flex-1 gap-1">
                  {weeksOf(days).map((week) => (
                    <div key={week[0]!.date} className="flex min-w-0 flex-1 gap-[2px]">
                      {week.map((day) => (
                        <span key={day.date} className="h-3 min-w-0 flex-1 rounded-[2px]" style={{ background: row.fill(day.entry) }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div aria-hidden className="flex justify-between pl-[84px] text-[11px] text-muted-foreground">
              <span>{formatDate(days[0]!.date, { style: 'bare' })}</span>
              <span>{h.today}</span>
            </div>
          </div>

          <div aria-hidden className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {h.legend.worst}
              {SCORE_FILL.map((fill) => <Swatch key={fill} fill={fill} />)}
              {h.legend.best}
            </span>
            <Swatch fill="var(--neg)" label={h.legend.ill} />
            <Swatch fill={TRAVEL_FILL} label={h.legend.travel} />
          </div>

          <div>
            <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{h.niggles}</h3>
            {episodes.length === 0 ? (
              <p className="border-t border-border pt-2 text-[13px] text-muted-foreground">{h.noNiggles(NIGGLE_WEEKS)}</p>
            ) : (
              <ul>
                {episodes.map((episode) => (
                  <EpisodeRow key={`${episode.site}-${episode.side ?? ''}-${episode.from}`} episode={episode} today={today} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/** The owner's alone, read from Firestore on the phone: the Athlete page's HTML is shared and never carries it. */
export function WellnessHistory() {
  const { isOwner } = useOwnerAuth()
  const [read, setRead] = useState<{ today: string; entries: Map<string, CheckIn> } | null>(null)

  useEffect(() => {
    if (!isOwner || !isClientFirebaseConfigured) return
    let cancelled = false
    const today = appTodayIso()
    readCheckInsSince(shiftDate(today, -(NIGGLE_WEEKS * 7 - 1)))
      .then((entries) => {
        if (!cancelled) setRead({ today, entries })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOwner])

  if (!isOwner || !read) return null
  return <WellnessHistoryView entries={read.entries} today={read.today} />
}
