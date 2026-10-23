import { DAY_MS } from '@/lib/calendarDate'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatClock, formatCountdown, formatDate } from '@/lib/formatters'
import { t } from '@/i18n'
import { DISTANCE_KEY } from '@/domain/activity/effort'

export interface FooterRace {
  race: UpcomingRace
  role?: 'primary' | 'tune_up'
  blockEndsHere?: boolean
}

const ROLE_LABEL = { primary: t.plan.raceFooter.primaryTarget, tune_up: t.plan.raceFooter.tuneUp } as const

const DISTANCE_ONLY = /^\s*\d+(?:[.,]\d+)?\s*(?:k|km|m|mi|miles?)\s*$/i

const NEXT_CHIP_FILL = 'var(--tone-caution)'
const NEXT_CHIP_INK = 'var(--zone-ink)'
// From --foreground, not the muted tokens: on white those fade the chip out.
const LATER_CHIP_BORDER = 'color-mix(in srgb, var(--foreground) 30%, transparent)'
const LATER_CHIP_TEXT = 'color-mix(in srgb, var(--foreground) 65%, transparent)'

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / DAY_MS)
}

// The sync stores the distance in Garmin's English ("Half-Marathon").
function distanceName(distance: string): string {
  const key = DISTANCE_KEY[distance]
  return (key && t.activity.bestEfforts.distances[key]) || distance
}

function raceTitle({ race }: FooterRace): string {
  const name = DISTANCE_ONLY.test(race.name) && race.location ? race.location : race.name
  const distance = race.distance ? distanceName(race.distance) : null
  const namesTheDistanceAlready =
    race.distance && [race.distance, distance!].some((label) => name.toLowerCase().includes(label.toLowerCase()))
  return namesTheDistanceAlready || !distance ? name : `${name} · ${distance}`
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
