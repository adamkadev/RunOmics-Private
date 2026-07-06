import { getMilestones } from '@/application/usecases/GetMilestones'
import { MilestonesTimeline } from '@/components/milestones/MilestonesTimeline'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

// Safety net: data is also revalidated on demand by /api/internal/revalidate
// when activities or records change.
export const revalidate = 86400

export default async function MilestonesPage() {
  const milestones = await getMilestones()

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.milestones.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.milestones.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.milestones.subtitle}</p>
      </div>

      <MilestonesTimeline milestones={milestones} />
    </div>
  )
}
