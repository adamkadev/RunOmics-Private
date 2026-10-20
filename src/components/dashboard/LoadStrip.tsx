import type { RecentLoad, RecentLoadDay } from '@/application/usecases/GetRecentLoad'
import { sessionZone, zoneColor } from '@/lib/colors'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

const TRACK_PX = 48
const MIN_BAR_PX = 3

function dayLetter(date: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return (t.plan.weekdays[weekday] ?? '').charAt(0).toUpperCase()
}

/**
 * A day's bar in the colour Plan draws its session in (3.0.2, mock 5f): blue
 * for an easy or long run, purple for threshold, and so on (sessionZone). A
 * day without a run keeps the hairline grey.
 *
 * Today without a run is not filled at all: it is an outline in the accent
 * (App Fixes, 5a rule 2 - today is a shape, not a colour), so a cyan accent
 * beside an easy run's blue still reads as today.
 */
export function loadBarColor(day: RecentLoadDay): string {
  if (day.type) return zoneColor(sessionZone(day))
  return day.isToday ? 'transparent' : 'var(--line-2)'
}

/** Today's bar carries the accent as its outline instead of its fill. */
export function loadBarOutline(day: RecentLoadDay): string | undefined {
  return !day.type && day.isToday ? '1.5px solid var(--accent)' : undefined
}

export function LoadStrip({ recent }: { recent: RecentLoad }) {
  const s = t.dashboard.loadStrip
  const scale = (value: number) => Math.round((value / recent.peak) * TRACK_PX)

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-card px-3.5 py-3 shadow-card" data-testid="load-strip">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[13px] font-semibold text-foreground">{s.title}</h2>
        <p className="text-[11px] text-muted-foreground tabular-nums">{s.band(recent.band.lo, recent.band.hi)}</p>
      </div>
      <ul className="flex items-end gap-1.5">
        {recent.days.map((day) => (
          <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="relative flex w-full items-end" style={{ height: TRACK_PX }}>
              <span
                aria-hidden
                className="absolute inset-x-0 border-y border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/[0.08]"
                style={{ bottom: scale(recent.band.lo), height: Math.max(1, scale(recent.band.hi) - scale(recent.band.lo)) }}
              />
              <span
                className="relative w-full rounded-[4px]"
                data-testid="load-bar"
                style={{
                  height: Math.max(MIN_BAR_PX, scale(day.load)),
                  background: loadBarColor(day),
                  border: loadBarOutline(day),
                }}
              >
                <span className="sr-only">{s.day(formatDate(day.date, { style: 'full' }), day.load)}</span>
              </span>
            </span>
            <span
              aria-hidden
              className={day.isToday ? 'text-[11px] font-semibold text-accent-text' : 'text-[11px] text-muted-foreground'}
            >
              {dayLetter(day.date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
