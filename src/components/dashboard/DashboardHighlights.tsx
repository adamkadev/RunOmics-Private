import Link from 'next/link'
import { Trophy, Flame, AlertTriangle, Flag, type LucideIcon } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { formatClock, formatDistance, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'

interface Highlight {
  key: string
  href: string
  Icon: LucideIcon
  tint: string
  label: string
}

// Glass-tinted pills (B10): translucent fill + tinted border, single hue for
// both themes since the pill already sits on the glass card's blur.
const TINT = {
  record: 'border-[#f0a500]/35 bg-[#f0a500]/[0.14] text-[#f0a500]',
  improvement: 'border-[#e8730c]/35 bg-[#e8730c]/[0.14] text-[#e8730c]',
  wear: 'border-red-500/35 bg-red-500/[0.14] text-red-500',
  race: 'border-[#3b82f6]/35 bg-[#3b82f6]/[0.14] text-[#3b82f6]',
}

function daysUntil(date: string): number {
  const today = new Date().toISOString().slice(0, 10)
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000
  )
}

interface Props {
  record: RecordEntry | null
  pbAlerts: PbAlert[]
  shoes: ShoeStats[]
  nextRace: UpcomingRace | null
}

/**
 * Single scrollable row of highlight pills - replaces the PR badge glued to
 * the title and the stacked alert lines. Each pill is a tinted, semantic
 * shortcut to the relevant page.
 */
export function DashboardHighlights({ record, pbAlerts, shoes, nextRace }: Props) {
  const highlights: Highlight[] = []

  if (record && record.seconds !== null && record.date !== null) {
    const stat = record.distanceKm != null ? formatDistance(record.distanceKm) : formatDuration(record.seconds)
    highlights.push({
      key: 'record',
      href: record.activityId ? `/activities/${record.activityId}` : '/records',
      Icon: Trophy,
      tint: TINT.record,
      label: `${record.label} ${stat}`,
    })
  }

  for (const a of pbAlerts) {
    highlights.push({
      key: `pb-${a.key}`,
      href: `/activities/${a.activityId}`,
      Icon: Flame,
      tint: TINT.improvement,
      label: `${a.label} - ${(formatClock(a.diffSeconds))}`,
    })
  }

  if (nextRace) {
    highlights.push({
      key: 'race',
      href: '/goals',
      Icon: Flag,
      tint: TINT.race,
      label: `D-${daysUntil(nextRace.date)}`,
    })
  }

  for (const shoe of shoes.filter((s) => s.nearingLimit)) {
    highlights.push({
      key: `shoe-${shoe.gearId}`,
      href: `/shoes/${shoe.gearId}`,
      Icon: AlertTriangle,
      tint: TINT.wear,
      label: shoe.name,
    })
  }

  if (highlights.length === 0) return null

  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {highlights.map(({ key, href, Icon, tint, label }) => (
        <Link key={key} href={href} className="shrink-0">
          <Pill variant="highlight" className={tint}>
            <Icon size={13} className="shrink-0" aria-hidden="true" />
            {label}
          </Pill>
        </Link>
      ))}
    </div>
  )
}
