'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { YearData } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDate, formatDuration, formatSignedDuration } from '@/lib/formatters'
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

const AMBER = 'var(--tone-caution)'

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

/** A done race: a solid accent dot with its check. */
function DoneDot({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
      style={{ width: size, height: size }}
    >
      <Check size={size - 6} strokeWidth={3.5} />
    </span>
  )
}

/** A race still ahead: an amber ring. */
function UpcomingRing({ size = 16 }: { size?: number }) {
  return (
    <span aria-hidden className="block shrink-0 rounded-full bg-card" style={{ width: size, height: size, border: `2px solid ${AMBER}` }} />
  )
}

/** Jan-Dec as one strip: the year so far, today, the block and the races. */
function SeasonStrip({ year, today, rows, block }: { year: number; today: string; rows: SeasonRaceRow[]; block: SeasonBlock | null }) {
  const thisYear = Number(today.slice(0, 4)) === year
  const done = today.slice(0, 4) > String(year) ? 1 : thisYear ? yearFraction(today, year) : 0
  const initials = new Intl.DateTimeFormat(t.locale, { month: 'narrow', timeZone: 'UTC' })
  const showBlock = block !== null && Number(block.raceDate.slice(0, 4)) === year
  const bandFrom = showBlock ? yearFraction(block.startDate < `${year}-01-01` ? `${year}-01-01` : block.startDate, year) : 0
  const bandTo = showBlock ? yearFraction(block.raceDate, year) : 0

  const line: CSSProperties = { top: 30 }
  return (
    <div className="relative mt-2 h-[62px]" data-testid="season-strip" aria-hidden>
      {/* The track, and the year run so far. */}
      <span className="absolute inset-x-0 h-0.5 -translate-y-1/2 rounded-full bg-border" style={line} />
      <span className="absolute left-0 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground" style={{ ...line, width: pct(done) }} />
      {showBlock && (
        <span
          data-testid="season-block"
          className="absolute h-3.5 -translate-y-1/2 rounded-[4px]"
          style={{
            ...line,
            left: pct(bandFrom),
            width: pct(Math.max(0, bandTo - bandFrom)),
            background: `color-mix(in oklab, ${AMBER} 18%, transparent)`,
            border: `1px solid color-mix(in oklab, ${AMBER} 45%, transparent)`,
          }}
        />
      )}
      {thisYear && (
        <>
          <span className="absolute h-[18px] w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" style={{ ...line, left: pct(done) }} />
          <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-caption font-bold text-foreground" style={{ left: pct(done) }}>
            {t.goals.season.today}
          </span>
        </>
      )}
      {rows.map((row) => {
        const at = yearFraction(row.date!, year)
        const upcoming = row.kind === 'scheduled'
        return (
          <span key={row.distance} data-testid={`season-marker-${upcoming ? 'upcoming' : 'done'}`}>
            <span
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-caption font-bold"
              style={{ left: pct(at), color: upcoming ? AMBER : 'var(--foreground)' }}
            >
              {row.short}
            </span>
            <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ ...line, left: pct(at) }}>
              {upcoming ? <UpcomingRing /> : <DoneDot />}
            </span>
          </span>
        )
      })}
      {/* Month initials under the strip, each at its month's start. */}
      {Array.from({ length: 12 }, (_, month) => (
        <span
          key={month}
          className="absolute bottom-0 text-caption font-semibold leading-none text-muted-foreground"
          style={{ left: pct(yearFraction(`${year}-${String(month + 1).padStart(2, '0')}-01`, year)) }}
        >
          {initials.format(new Date(Date.UTC(year, month, 1)))}
        </span>
      ))}
    </div>
  )
}

function Marker({ kind }: { kind: 'upcoming' | 'done' | 'today' }) {
  if (kind === 'today') return <span aria-hidden className="mx-auto block h-0.5 w-3 rounded-full bg-foreground" />
  return kind === 'upcoming' ? <UpcomingRing /> : <DoneDot />
}

/** One race in the timeline: date and countdown, name, target, and the time. */
function TimelineRow({ row, block, last }: { row: SeasonRaceRow; block: SeasonBlock | null; last: boolean }) {
  const s = t.goals
  const upcoming = row.kind === 'scheduled'
  const date = formatDate(row.date!, { style: 'bare', year: 'never' }).toUpperCase()
  const eyebrow = upcoming && row.countdownText ? `${date} · ${row.countdownText}` : date
  const isBlockRace = upcoming && block !== null && block.raceDate === row.date
  const sub = [
    row.targetSeconds !== null ? s.targetTime(formatDuration(row.targetSeconds)) : null,
    isBlockRace ? s.season.blockWeek(row.short, block!.week, block!.weeks) : null,
  ].filter((part): part is string => part !== null)
  const delta = !upcoming && row.seconds !== null && row.targetSeconds !== null ? row.seconds - row.targetSeconds : null

  return (
    <li className="flex gap-3" data-testid={`timeline-${upcoming ? 'upcoming' : 'done'}`}>
      <div className="flex w-4 shrink-0 flex-col items-center pt-0.5">
        <Marker kind={upcoming ? 'upcoming' : 'done'} />
        {!last && <span aria-hidden className="mt-1 w-0.5 flex-1 rounded-full bg-border" />}
      </div>
      {/* The gap before the next row; the last row ends on the card's own padding. */}
      <div className={cn('flex min-w-0 flex-1 items-start justify-between gap-3', !last && 'pb-4')}>
        <div className="min-w-0">
          <p className="text-caption font-bold tracking-[0.06em]" style={{ color: upcoming ? AMBER : 'var(--muted-foreground)' }}>
            {eyebrow}
          </p>
          <p className="mt-0.5 truncate font-display text-body font-bold text-foreground">{row.title}</p>
          {sub.length > 0 && <p className="mt-0.5 text-footnote text-muted-foreground">{sub.join(' · ')}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-body font-bold tabular-nums text-foreground">{row.seconds !== null ? formatDuration(row.seconds) : '–'}</p>
          {upcoming ? (
            <p className="text-caption text-muted-foreground">{s.predictedTag}</p>
          ) : (
            delta !== null && (
              <p className={cn('text-caption font-bold tabular-nums', delta <= 0 ? 'text-accent-text' : 'text-muted-foreground')} data-testid="timeline-delta">
                {formatSignedDuration(delta)}
              </p>
            )
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * The season (C3, v4.4): Jan-Dec as a strip - the year so far, today, the
 * training block and the races on it - then the races as a timeline, newest
 * first, with today between what is ahead and what is done. A race with no
 * date yet has no place on either and gets its own card.
 */
export function SeasonTimeline({ yearData, today, block }: { yearData: YearData; today: string; block: SeasonBlock | null }) {
  const rows = seasonRaceRows(yearData, today)
  const dated = rows.filter((row) => row.date !== null).sort((a, b) => b.date!.localeCompare(a.date!))
  const open = rows.filter((row) => row.date === null)
  if (rows.length === 0) return null

  const ahead = dated.filter((row) => row.kind === 'scheduled')
  const past = dated.filter((row) => row.kind === 'done')
  const thisYear = Number(today.slice(0, 4)) === yearData.year
  const s = t.goals

  return (
    <>
      {dated.length > 0 && (
        <GlassSurface variant="card" className="rounded-card-sm px-4 py-4" data-testid="season-card">
          <h2 className="font-display text-body font-bold text-foreground">{s.season.title}</h2>
          <SeasonStrip year={yearData.year} today={today} rows={dated} block={block} />
          <ol className="mt-4">
            {ahead.map((row, i) => (
              <TimelineRow key={row.distance} row={row} block={block} last={i === ahead.length - 1 && !thisYear && past.length === 0} />
            ))}
            {thisYear && (
              <li className="flex gap-3" data-testid="timeline-today">
                <div className="flex w-4 shrink-0 flex-col items-center pt-2">
                  <Marker kind="today" />
                  {past.length > 0 && <span aria-hidden className="mt-2 w-0.5 flex-1 rounded-full bg-border" />}
                </div>
                <p className={cn('text-caption font-bold tracking-[0.06em] text-foreground', past.length > 0 && 'pb-4')}>
                  {s.season.todayOn(formatDate(today, { style: 'bare', year: 'never' }).toUpperCase())}
                </p>
              </li>
            )}
            {past.map((row, i) => (
              <TimelineRow key={row.distance} row={row} block={block} last={i === past.length - 1} />
            ))}
          </ol>
        </GlassSurface>
      )}

      {open.length > 0 && (
        <GlassSurface variant="card" className="rounded-card-sm px-4 pb-1 pt-3.5" data-testid="season-no-date">
          <h2 className="text-caption uppercase tracking-[0.08em] text-muted-foreground">{s.season.noDate}</h2>
          <ul>
            {open.map((row) => (
              <li key={row.distance} className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-b-0">
                <span className="min-w-0 truncate text-body">
                  <span className="font-bold text-foreground">{row.short}</span>
                  {row.targetSeconds !== null && (
                    <span className="text-muted-foreground"> · {s.targetTime(formatDuration(row.targetSeconds))}</span>
                  )}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-foreground">{row.seconds !== null ? formatDuration(row.seconds) : '–'}</span>
              </li>
            ))}
          </ul>
        </GlassSurface>
      )}
    </>
  )
}
