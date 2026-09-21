import { ShoeWearAlertLine } from '@/components/shoes/ShoeWearAlertLine'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'

export function DashboardHighlights({ shoes }: { shoes: ShoeStats[] }) {
  return <ShoeWearAlertLine shoes={shoes} />
}
