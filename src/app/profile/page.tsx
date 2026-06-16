import { getRunnerProfile } from '@/application/usecases/GetRunnerProfile'
import { getTrainingZones } from '@/application/usecases/GetTrainingZones'
import { getRecords } from '@/application/usecases/GetRecords'
import { ProfileOverview } from '@/components/profile/ProfileOverview'
import { t } from '@/i18n'

export default function ProfilePage() {
  const profile = getRunnerProfile()
  const zones = getTrainingZones()
  const records = getRecords()
  const p = t.profile

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{p.pageTitle}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{p.pageSubtitle}</p>
      </div>

      {!profile && <p className="text-sm text-subtle">{t.coach.noData}</p>}

      {profile && <ProfileOverview profile={profile} zones={zones} records={records} />}
    </div>
  )
}
