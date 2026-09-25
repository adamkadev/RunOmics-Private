import { DAY_MS } from '@/lib/calendarDate'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatClock, formatCountdown, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'

export interface FooterRace {
  race: UpcomingRace
  role?: 'primary' | 'tune_up'
  blockEndsHere?: boolean
}

const ROLE_LABEL = { primary: t.plan.raceFooter.primaryTarget, tune_up: t.plan.raceFooter.tuneUp } as const

const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

const NEXT_CHIP_FILL = '#f5b13d'
const NEXT_CHIP_INK = '#091020'
// Derived straight from --foreground rather than the muted/subtle tokens -
// on white this chip was a pale-grey outline around pale-grey text, quiet
// enough to disappear; it can stay quieter than the amber "next" chip
// without going invisible.
const LATER_CHIP_BORDER = 'color-mix(in srgb, var(--foreground) 30%, transparent)'
const LATER_CHIP_TEXT = 'color-mix(in srgb, var(--foreground) 65%, transparent)'

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS)
}

// Line 1 is the race itself - name and distance, the same read as an
// Activities row. Line 2 is everything about when and why: date, target time,
// then whichever one of role or block-end applies (a race is never both).
function raceTitle({ race }: FooterRace): string {
  const name = DISTANCE_ONLY.test(race.name) && race.location ? race.location : race.name
  const namesTheDistanceAlready = race.distance && name.toLowerCase().includes(race.distance.toLowerCase())
  return namesTheDistanceAlready || !race.distance ? name : `${name} · ${race.distance}`
}

function raceDetail({ race, role, blockEndsHere }: FooterRace): string {
  return [
    formatDate(race.date, { style: 'bare' }),
    race.targetSeconds ? t.plan.raceFooter.targetTime(formatClock(race.targetSeconds)) : null,
    blockEndsHere ? t.plan.raceFooter.blockEndsHere : role ? ROLE_LABEL[role] : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Each race is its own standalone card on the page background - not rows
// sharing one outer card, which read as a card inside a card.
export function RaceFooter({ races, today }: { races: FooterRace[]; today: string }) {
  const ordered = [...races].sort((a, b) => a.race.date.localeCompare(b.race.date))
  if (!ordered.length) return null

  return (
    <div data-testid="race-footer" className="flex flex-col" style={{ gap: '8px' }}>
      {ordered.map((entry, i) => {
        const { race } = entry
        const isNext = i === 0
        return (
          <GlassSurface
            variant="card"
            key={`${race.date}-${race.name}`}
            className="flex items-center justify-between gap-3 rounded-2xl"
            style={{ padding: '13px 14px' }}
          >
            <div className="min-w-0">
              <div className="truncate text-footnote font-semibold text-foreground">{raceTitle(entry)}</div>
              <div className="truncate text-caption text-muted-foreground">{raceDetail(entry)}</div>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums"
              style={{
                letterSpacing: 'normal',
                ...(isNext
                  ? { background: NEXT_CHIP_FILL, color: NEXT_CHIP_INK }
                  : { border: `1px solid ${LATER_CHIP_BORDER}`, color: LATER_CHIP_TEXT }),
              }}
            >
              {formatCountdown(daysBetween(today, race.date))}
            </span>
          </GlassSurface>
        )
      })}
    </div>
  )
}
