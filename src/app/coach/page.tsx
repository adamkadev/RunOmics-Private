import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getCoachData } from '@/application/usecases/GetCoachData'
import { TrainingStatusBanner } from '@/components/dashboard/TrainingStatusBanner'
import { CoachOverview } from '@/components/coach/CoachOverview'
import { t } from '@/i18n'

export default function CoachPage() {
  const status = getTrainingStatus()
  const coach = getCoachData()
  const c = t.coach

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{c.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{c.subtitle}</p>
      </div>

      {status && <TrainingStatusBanner status={status} />}

      {!coach && (
        <p className="text-sm text-subtle">{c.noData}</p>
      )}

      {coach && <CoachOverview coach={coach} />}
    </div>
  )
}
