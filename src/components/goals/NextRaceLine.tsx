import Link from 'next/link'
import { Flag } from 'lucide-react'
import { t } from '@/i18n'
import type { UpcomingRace } from '@/application/usecases/GetGoalsData'

export function NextRaceLine({ race }: { race: UpcomingRace | null }) {
  if (!race) return null

  const today = new Date().toISOString().slice(0, 10)
  const daysUntil = Math.round(
    (new Date(race.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86_400_000
  )

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
      <Flag className="h-4 w-4 shrink-0" aria-hidden="true" />
      <Link href="/goals" className="underline-offset-2 hover:underline">
        {t.nextRace.line(race.name, race.distance, t.goals.daysUntil(daysUntil))}
      </Link>
    </p>
  )
}
