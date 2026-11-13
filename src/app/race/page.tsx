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
  const back = <BackButton label={t.race.back} fallbackHref="/profile" />

  return (
    data ? <RaceView data={data} back={back} /> : <NoRace back={back} />
  )
}
