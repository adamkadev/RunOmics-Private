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

const TINT = {
  record: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  improvement: 'border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  wear: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
  race: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400',
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
      label: `${a.label} ${t.pbAlerts.off(formatClock(a.diffSeconds))}`,
    })
  }

  if (nextRace) {
    highlights.push({
      key: 'race',
      href: '/goals',
      Icon: Flag,
      tint: TINT.race,
      label: `${nextRace.name} · ${t.goals.daysUntil(daysUntil(nextRace.date))}`,
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
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
