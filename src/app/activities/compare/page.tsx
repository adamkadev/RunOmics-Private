import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { getActivities } from '@/application/usecases/GetActivities'
import { ActivityCompareClient } from '@/components/activity/ActivityCompareClient'
import { formatDate } from '@/lib/formatters'
import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'

function getComparedActivities(ids: string | undefined): { a: Activity; b: Activity } | null {
  const [idA, idB] = (ids ?? '').split(',').filter(Boolean)
  if (!idA || !idB || idA === idB) return null

  const activities = getActivities()
  const a = activities.find((act) => act.id === idA)
  const b = activities.find((act) => act.id === idB)
  if (!a || !b) return null

  return { a, b }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}): Promise<Metadata> {
  const { ids } = await searchParams
  const pair = getComparedActivities(ids)
  if (!pair) return { title: t.compare.title }

  return { title: `${t.compare.title}: ${formatDate(pair.a.date)} vs ${formatDate(pair.b.date)}` }
}

export default async function ActivityComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const pair = getComparedActivities(ids)
  if (!pair) notFound()

  return (
    <div className="space-y-5">
      <BackButton label={t.activity.back} fallbackHref="/activities" />
      <h1 className="text-display text-foreground">{t.compare.title}</h1>
      <ActivityCompareClient a={pair.a} b={pair.b} />
    </div>
  )
}
