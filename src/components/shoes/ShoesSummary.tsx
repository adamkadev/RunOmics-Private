import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { round } from '@/lib/math'
import { t } from '@/i18n'

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-2.5 py-2.5 text-center">
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  )
}

export function ShoesSummary({ shoes }: { shoes: ShoeStats[] }) {
  const s = t.shoes.summary

  const totalKm = round(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0), 0)
  const activePairs = shoes.filter((shoe) => !shoe.retired).length
  const totalSessions = shoes.reduce((sum, shoe) => sum + shoe.sessionCount, 0)

  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat value={<AnimatedValue value={totalKm} />} label={s.totalDistance} />
      <Stat value={<AnimatedValue value={activePairs} />} label={s.activePairs} />
      <Stat value={<AnimatedValue value={totalSessions} />} label={s.sessions} />
    </div>
  )
}
