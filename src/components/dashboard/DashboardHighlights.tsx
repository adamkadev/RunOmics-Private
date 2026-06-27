'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/utils'
import { formatClock, formatDistance, formatDuration } from '@/lib/formatters'
import type { RecordEntry } from '@/application/usecases/GetRecords'
import type { PbAlert } from '@/application/usecases/GetPbAlerts'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'

interface Highlight {
  key: string
  href: string
  dotColor: string
  tint: string
  label: string
}

const TINT = {
  record:      { pill: 'border-[#f0a500]/35 bg-[#f0a500]/[0.14] text-[#f0a500]', dot: '#f0a500' },
  improvement: { pill: 'border-[#a855f7]/35 bg-[#a855f7]/[0.14] text-[#a855f7]', dot: '#a855f7' },
  wear:        { pill: 'border-red-500/35 bg-red-500/[0.14] text-red-500',        dot: '#ef4444' },
  race:        { pill: 'border-[#3b82f6]/35 bg-[#3b82f6]/[0.14] text-[#3b82f6]', dot: '#3b82f6' },
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

export function DashboardHighlights({ record, pbAlerts, shoes, nextRace }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const highlights: Highlight[] = []

  if (record && record.seconds !== null && record.date !== null) {
    const stat = record.distanceKm != null ? formatDistance(record.distanceKm) : formatDuration(record.seconds)
    highlights.push({
      key: 'record',
      href: record.activityId ? `/activities/${record.activityId}` : '/records',
      dotColor: TINT.record.dot,
      tint: TINT.record.pill,
      label: `PR · ${record.label} - ${stat}`,
    })
  }

  for (const a of pbAlerts) {
    highlights.push({
      key: `pb-${a.key}`,
      href: `/activities/${a.activityId}`,
      dotColor: TINT.improvement.dot,
      tint: TINT.improvement.pill,
      label: `${a.label} - ${(formatClock(a.diffSeconds))}`,
    })
  }

  if (nextRace) {
    highlights.push({
      key: 'race',
      href: '/goals',
      dotColor: TINT.race.dot,
      tint: TINT.race.pill,
      label: `${nextRace.name} · D-${daysUntil(nextRace.date)}`,
    })
  }

  for (const shoe of shoes.filter((s) => s.nearingLimit)) {
    highlights.push({
      key: `shoe-${shoe.gearId}`,
      href: `/shoes/${shoe.gearId}`,
      dotColor: TINT.wear.dot,
      tint: TINT.wear.pill,
      label: shoe.name,
    })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const update = () => setCanScrollRight(el.scrollWidth - el.scrollLeft - el.clientWidth > 1)
    update()

    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [highlights.length])

  if (highlights.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className={cn(
        '-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        canScrollRight && '[mask-image:linear-gradient(to_right,black_85%,transparent_100%)]'
      )}
    >
      {highlights.map(({ key, href, dotColor, tint, label }) => (
        <Link key={key} href={href} className="shrink-0">
          <Pill variant="highlight" className={tint} dotColor={dotColor}>
            {label}
          </Pill>
        </Link>
      ))}
    </div>
  )
}
