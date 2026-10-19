import type { RecentLoad } from '@/application/usecases/GetRecentLoad'
import { formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

const TRACK_PX = 48
const MIN_BAR_PX = 3

export function LoadStrip({ recent }: { recent: RecentLoad }) {
  const s = t.dashboard.loadStrip
  const scale = (value: number) => Math.round((value / recent.peak) * TRACK_PX)

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-card px-3.5 py-3 shadow-card" data-testid="load-strip">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[13px] font-semibold text-foreground">{s.title}</h2>
        <p className="text-[11px] text-muted-foreground tabular-nums">{s.band(recent.band.lo, recent.band.hi)}</p>
      </div>
      <ul className="relative flex items-end gap-1.5" style={{ height: TRACK_PX }}>
        <li
          aria-hidden
          className="absolute inset-x-0 rounded-[2px] border-y border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/[0.08]"
          style={{ bottom: scale(recent.band.lo), height: Math.max(1, scale(recent.band.hi) - scale(recent.band.lo)) }}
        />
        {recent.days.map((day) => (
          <li
            key={day.date}
            className="relative flex-1 rounded-[4px]"
            style={{
              height: Math.max(MIN_BAR_PX, scale(day.load)),
              background: day.isToday ? 'var(--accent)' : 'var(--line-2)',
            }}
          >
            <span className="sr-only">{s.day(formatDate(day.date, { style: 'full' }), day.load)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
