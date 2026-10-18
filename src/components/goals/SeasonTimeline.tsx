'use client'

import type { ReactNode } from 'react'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { seasonRaceRows, type SeasonRaceRow } from './SeasonRaces'

/** The training block the next race closes: its span and where today is in it. */
export interface SeasonBlock {
  startDate: string
  raceDate: string
  week: number
  weeks: number
}

const TITLE = 'text-[15px] font-semibold text-foreground'

function utcDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

/** Where a date sits along the year, 0 at Jan 1 and 1 at Dec 31, clamped. */
export function yearFraction(iso: string, year: number): number {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  return Math.min(1, Math.max(0, (utcDay(iso) - start) / (end - start)))
}

const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`

/** The strip's line, its vertical centre in px. */
const LINE_Y = 27
const LABEL_H = 14
const LABEL_GAP = 6
/** The narrowest strip the labels are laid out for: a phone's card. */
const MIN_STRIP_PX = 280
/** About how wide an 11 px semibold character is, and the air kept between two labels. */
const LABEL_CH_PX = 6.5
const LABEL_AIR_PX = 6

export type Lane = 'above' | 'below'

/**
 * Which side of the line each label goes (screen audit, Oct 2026): "Marathon",
 * "Today" and "10K" a few weeks apart were drawn over one another as
 * "MarTodayl0K". The races first, in date order, each on its preferred side
 * unless it would touch a label already there, then the other; Today last, on
 * whichever side is free, and when neither is it keeps its tick without a
 * label - the accent line already ends there. Laid out for the narrowest
 * strip, so a wider one only has more air. null is a mark with no label.
 */
export function stripLanes(
  marks: readonly { at: number; label: string; prefer: Lane; optional?: boolean }[],
  widthPx = MIN_STRIP_PX,
): (Lane | null)[] {
  const spans = marks.map(({ at, label }) => {
    const half = (label.length * LABEL_CH_PX) / 2
    return { left: at * widthPx - half, right: at * widthPx + half }
  })
  const placed: { lane: Lane; left: number; right: number }[] = []
  const free = (lane: Lane, i: number) =>
    placed.every((p) => p.lane !== lane || p.right + LABEL_AIR_PX <= spans[i]!.left || spans[i]!.right + LABEL_AIR_PX <= p.left)
  const order = marks.map((_, i) => i).sort((a, b) => Number(!!marks[a]!.optional) - Number(!!marks[b]!.optional) || marks[a]!.at - marks[b]!.at)
  const lanes: (Lane | null)[] = marks.map(() => null)
  for (const i of order) {
    const { prefer, optional } = marks[i]!
    const other: Lane = prefer === 'above' ? 'below' : 'above'
    const lane = free(prefer, i) ? prefer : free(other, i) ? other : optional ? null : prefer
    lanes[i] = lane
    if (lane) placed.push({ lane, ...spans[i]! })
  }
  return lanes
}

/** A mark on the strip, centred on its date, its label above or below the line. */
function Mark({
  at,
  label,
  lane,
  markHeight,
  labelClassName,
  children,
  testId,
}: {
  at: number
  /** Null draws the mark alone: Today when both sides are taken. */
  label: string | null
  lane: Lane
  /** The mark's own height, so its centre lands on the line. */
  markHeight: number
  labelClassName?: string
  children: ReactNode
  testId?: string
}) {
  const top = lane === 'above' ? LINE_Y - LABEL_H - LABEL_GAP - markHeight / 2 : LINE_Y - markHeight / 2
  const text = label !== null && <span className={cn('whitespace-nowrap text-[11px] font-semibold leading-[14px] text-foreground', labelClassName)}>{label}</span>
  return (
    <span className="absolute flex -translate-x-1/2 flex-col items-center gap-1.5" style={{ left: pct(at), top }} data-testid={testId} data-lane={lane}>
      {lane === 'above' && text}
      {children}
      {lane === 'below' && text}
    </span>
  )
}

/**
 * Jan-Dec as one strip (v4.17): the year so far in the accent to today, a
 * race done a filled circle in text ink, one ahead an outlined one. Filled,
 * not the pos green: the lime dot on the teal line read as a clash (screen
 * audit, Oct 2026), and shape already says done.
 */
function SeasonStrip({ year, today, rows }: { year: number; today: string; rows: SeasonRaceRow[] }) {
  const thisYear = Number(today.slice(0, 4)) === year
  const done = today.slice(0, 4) > String(year) ? 1 : thisYear ? yearFraction(today, year) : 0
  const months = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' })

  const marks = [
    ...rows.map((row) => ({ at: yearFraction(row.date!, year), label: row.short, prefer: 'above' as Lane })),
    ...(thisYear ? [{ at: done, label: t.goals.season.today, prefer: 'below' as Lane, optional: true }] : []),
  ]
  const lanes = stripLanes(marks)
  const todayLane = thisYear ? lanes.at(-1)! : null
  const anyBelow = lanes.includes('below')

  return (
    <div aria-hidden>
      {/* Taller when a label sits under the line, so it clears the months. */}
      <div className={cn('relative', anyBelow ? 'h-[60px]' : 'h-11')} data-testid="season-strip">
        <span className="absolute inset-x-0 top-[26px] h-0.5 rounded-full bg-[var(--line-2)]" />
        <span className="absolute left-0 top-[26px] h-0.5 rounded-full bg-accent" style={{ width: pct(done) }} data-testid="season-done" />
        {rows.map((row, i) => {
          const upcoming = row.kind === 'scheduled'
          return (
            <Mark key={row.distance} at={marks[i]!.at} label={row.short} lane={lanes[i] ?? 'above'} markHeight={12} testId={`season-marker-${upcoming ? 'upcoming' : 'done'}`}>
              {upcoming ? (
                <span className="box-border block size-3 rounded-full border-2 border-foreground bg-card" />
              ) : (
                <span className="block size-3 rounded-full bg-foreground" />
              )}
            </Mark>
          )
        })}
        {thisYear && (
          <Mark at={done} label={todayLane ? t.goals.season.today : null} lane={todayLane ?? 'below'} markHeight={14} labelClassName="text-accent-text" testId="season-today">
            <span className="block h-3.5 w-0.5 bg-accent" />
          </Mark>
        )}
      </div>
      <div className="mt-1 grid grid-cols-12 text-[11px] text-muted-foreground">
        {Array.from({ length: 12 }, (_, month) => (
          <span key={month} className="whitespace-nowrap">{months.format(new Date(Date.UTC(year, month, 1))).replace(/\.$/, '')}</span>
        ))}
      </div>
    </div>
  )
}

/** A time's meaning under it: the gap to target, coloured by what it means. */
function outcome(row: SeasonRaceRow): { text: string; tone: 'pos' | 'warn' | 'muted' } {
  const s = t.goals.season
  const upcoming = row.kind === 'scheduled'
  if (row.seconds === null || row.targetSeconds === null) return { text: upcoming ? t.goals.predictedTag : t.goals.finish, tone: 'muted' }
  const gap = row.seconds - row.targetSeconds
  if (upcoming) return gap > 0 ? { text: s.predictedOff(formatDuration(gap)), tone: 'warn' } : { text: s.predictedUnder(formatDuration(-gap)), tone: 'pos' }
  return gap > 0 ? { text: s.overTarget(formatDuration(gap)), tone: 'warn' } : { text: s.underTarget(formatDuration(-gap)), tone: 'pos' }
}

const TONE_CLASS = { pos: 'text-[var(--pos)]', warn: 'text-[var(--warn)]', muted: 'text-muted-foreground' } as const

/** One race: its date and countdown, name, target and plan week; its prediction or result. */
function RaceRow({ row, block }: { row: SeasonRaceRow; block: SeasonBlock | null }) {
  const s = t.goals.season
  const upcoming = row.kind === 'scheduled'
  const date = formatDate(row.date!, { style: 'bare', year: 'never' })
  const when = upcoming ? (row.daysUntil !== null ? s.inDays(row.daysUntil) : null) : s.done
  const isBlockRace = upcoming && block !== null && block.raceDate === row.date
  const sub = [
    row.targetSeconds !== null ? s.target(formatDuration(row.targetSeconds)) : null,
    isBlockRace ? s.planWeek(block!.week, block!.weeks) : null,
  ].filter((part): part is string => part !== null)
  const result = outcome(row)

  return (
    <li className="flex items-start justify-between gap-4 border-t border-border py-3.5 last:pb-0" data-testid={`timeline-${upcoming ? 'upcoming' : 'done'}`}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{[date, when].filter(Boolean).join(' · ')}</span>
        <span className="break-words text-[15px] font-semibold text-foreground text-pretty">{row.title}</span>
        {sub.length > 0 && <span className="text-xs text-muted-foreground">{sub.join(' · ')}</span>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[3px] text-right">
        <span className="text-lg font-semibold text-foreground">{row.seconds !== null ? formatDuration(row.seconds) : '–'}</span>
        <span className={cn('text-xs', TONE_CLASS[result.tone])} data-testid="timeline-delta" data-tone={result.tone}>
          {result.text}
        </span>
      </div>
    </li>
  )
}

/**
 * The season (C3, v4.4; v4.17): Jan-Dec as a strip with today and the
 * races on it, then the races as rows - what is ahead, next first, then
 * what is done, most recent first - each with its prediction or result. A
 * goal with no date has no place on either and gets its own card.
 */
export function SeasonTimeline({ yearData, today, block }: { yearData: YearData; today: string; block: SeasonBlock | null }) {
  const rows = seasonRaceRows(yearData, today)
  const dated = rows.filter((row) => row.date !== null)
  // A past year has no undated goals (v5.5 #25): "10K · –" in 2025 is a race
  // that can no longer be set, and its only time would be today's prediction.
  const pastYear = Number(today.slice(0, 4)) > yearData.year
  const open = pastYear ? [] : rows.filter((row) => row.date === null)
  if (rows.length === 0) return null

  const ahead = dated.filter((row) => row.kind === 'scheduled').sort((a, b) => a.date!.localeCompare(b.date!))
  const past = dated.filter((row) => row.kind === 'done').sort((a, b) => b.date!.localeCompare(a.date!))
  const s = t.goals

  return (
    <>
      {dated.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-4' })} data-testid="season-card">
          <h2 className={TITLE}>{s.season.title}</h2>
          <SeasonStrip year={yearData.year} today={today} rows={dated} />
          <ol>
            {[...ahead, ...past].map((row) => (
              <RaceRow key={row.distance} row={row} block={block} />
            ))}
          </ol>
        </section>
      )}

      {open.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col' })} data-testid="season-no-date">
          <h2 className={cn(TITLE, 'pb-1.5')}>{s.season.noDate}</h2>
          <ul>
            {open.map((row) => (
              <li key={row.distance} className="flex items-baseline justify-between gap-3 border-t border-border py-3 text-sm last:pb-0">
                <span className="min-w-0 break-words text-pretty">
                  <b className="font-semibold text-foreground">{row.short}</b>
                  <span className="text-muted-foreground"> · {row.targetSeconds !== null ? s.targetTime(formatDuration(row.targetSeconds)) : s.season.noTarget}</span>
                </span>
                <span className="shrink-0">
                  {row.seconds !== null ? (
                    <>
                      <span className="text-xs text-muted-foreground">{s.predictedTag}</span>{' '}
                      <b className="font-semibold text-foreground">{formatDuration(row.seconds)}</b>
                    </>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
