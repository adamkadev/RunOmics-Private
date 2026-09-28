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

/** A mark on the strip: its label over it, centred on its date. */
function Mark({ at, label, labelClassName, children, testId }: { at: number; label: string; labelClassName?: string; children: ReactNode; testId?: string }) {
  return (
    <span className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1.5" style={{ left: pct(at) }} data-testid={testId}>
      <span className={cn('whitespace-nowrap text-[11px] font-semibold leading-[14px] text-foreground', labelClassName)}>{label}</span>
      {children}
    </span>
  )
}

/**
 * Jan-Dec as one strip (v4.17): the year so far in the accent to today, a
 * race done in pos, one ahead an outlined circle.
 */
function SeasonStrip({ year, today, rows }: { year: number; today: string; rows: SeasonRaceRow[] }) {
  const thisYear = Number(today.slice(0, 4)) === year
  const done = today.slice(0, 4) > String(year) ? 1 : thisYear ? yearFraction(today, year) : 0
  const months = new Intl.DateTimeFormat(t.locale, { month: 'short', timeZone: 'UTC' })

  return (
    <div aria-hidden>
      <div className="relative h-11" data-testid="season-strip">
        <span className="absolute inset-x-0 top-[26px] h-0.5 rounded-full bg-[var(--line-2)]" />
        <span className="absolute left-0 top-[26px] h-0.5 rounded-full bg-accent" style={{ width: pct(done) }} data-testid="season-done" />
        {rows.map((row) => {
          const upcoming = row.kind === 'scheduled'
          return (
            <Mark key={row.distance} at={yearFraction(row.date!, year)} label={row.short} testId={`season-marker-${upcoming ? 'upcoming' : 'done'}`}>
              {upcoming ? (
                <span className="box-border block size-3 rounded-full border-2 border-foreground bg-card" />
              ) : (
                <span className="block size-3 rounded-full bg-[var(--pos)]" />
              )}
            </Mark>
          )
        })}
        {thisYear && (
          <Mark at={done} label={t.goals.season.today} labelClassName="text-accent-text" testId="season-today">
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
