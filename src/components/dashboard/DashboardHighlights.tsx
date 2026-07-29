import { ShoeWearAlertLine } from '@/components/shoes/ShoeWearAlertLine'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

// Race countdown intentionally absent: it already lives in TodayHero (D-x).
export function DashboardHighlights({ shoes }: { shoes: ShoeStats[] }) {
  return <ShoeWearAlertLine shoes={shoes} />
}
