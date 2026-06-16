import { IdCard, CalendarRange, Footprints, Activity } from 'lucide-react'
import type { RunnerProfileData } from '@/application/usecases/GetRunnerProfile'
import { TrainingZones } from '@/components/goals/TrainingZones'
import { RecordsSummary } from '@/components/records/RecordsSummary'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { t } from '@/i18n'
import type { TrainingZonesData } from '@/application/usecases/GetTrainingZones'
import type { RecordEntry } from '@/application/usecases/GetRecords'

const LEVEL_STYLE: Record<string, string> = {
  beginner:     'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  intermediate: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  experienced:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  veteran:      'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

interface Props {
  profile: RunnerProfileData
  zones: TrainingZonesData | null
  records: RecordEntry[]
}

export function ProfileOverview({ profile, zones, records }: Props) {
  const p = t.profile

  return (
    <>
      {/* Identity card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <IdCard size={28} className="shrink-0 text-violet-500 dark:text-violet-400" />
          <div>
            <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${LEVEL_STYLE[profile.experienceLevel]}`}>
              {p.level[profile.experienceLevel]}
            </span>
            <p className="mt-1 text-xs text-subtle">
              {p.since(
                new Date(profile.firstActivityDate + 'T00:00:00').toLocaleDateString(t.locale, {
                  month: 'short',
                  year: 'numeric',
                }),
              )}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{p.levelCaveat}</p>
      </div>

      {/* Career stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.yearsTracked}</span>
            <CalendarRange size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedValue value={profile.yearsTracked} decimals={1} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.totalDistance}</span>
            <Footprints size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedValue value={profile.totalDistanceKm} decimals={0} /> <span className="text-sm font-normal text-muted-foreground">{t.units.km}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.totalActivities}</span>
            <Activity size={18} className="text-orange-500 dark:text-orange-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedValue value={profile.totalActivities} />
          </p>
        </div>
      </div>

      {zones && <TrainingZones data={zones} />}

      <RecordsSummary records={records} />
    </>
  )
}
