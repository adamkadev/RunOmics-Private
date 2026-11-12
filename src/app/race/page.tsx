import { getRacePageData } from '@/application/usecases/GetRacePage'
import { loadData } from '@/application/usecases/LoadData'
import { NoRace, RaceView } from '@/components/race/RaceView'
import { BackButton } from '@/components/ui/BackButton'
import { appTodayIso } from '@/lib/calendarDate'
import { t } from '@/i18n'

export const revalidate = 3600

export default async function RacePage() {
  await loadData()
  const data = await getRacePageData(appTodayIso())

  return (
    <div className="space-y-4">
      <BackButton label={t.race.back} fallbackHref="/profile" />
      {data ? <RaceView data={data} /> : <NoRace />}
    </div>
  )
}
