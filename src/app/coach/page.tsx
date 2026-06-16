import { getCoachData } from '@/application/usecases/GetCoachData'
import { getPlanSnapshot } from '@/application/usecases/GetPlanSnapshot'
import { CoachOverview } from '@/components/coach/CoachOverview'
import { CoachPlanCard } from '@/components/coach/CoachPlanCard'
import { t } from '@/i18n'

export default function CoachPage() {
  const coach = getCoachData()
  const planSnapshot = getPlanSnapshot()
  const c = t.coach

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{c.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      {planSnapshot && <CoachPlanCard snapshot={planSnapshot} />}

      {!coach && (
        <p className="text-sm text-subtle">{c.noData}</p>
      )}

      {coach && <CoachOverview coach={coach} showSuggestions={!planSnapshot} />}
    </div>
  )
}
