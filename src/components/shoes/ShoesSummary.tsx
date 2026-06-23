import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { round } from '@/lib/math'
import { t } from '@/i18n'

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function ShoesSummary({ shoes }: { shoes: ShoeStats[] }) {
  const s = t.shoes.summary

  const totalKm = round(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0), 1)
  const activePairs = shoes.filter((shoe) => !shoe.retired).length
  const totalSessions = shoes.reduce((sum, shoe) => sum + shoe.sessionCount, 0)

  return (
    <GlassSurface variant="card" className="overflow-hidden rounded-[22px]">
      <div className="grid grid-cols-3 gap-2 px-4 py-4">
        <Stat value={<AnimatedValue value={totalKm} decimals={1} />} label={s.totalDistance} />
        <Stat value={<AnimatedValue value={activePairs} />}          label={s.activePairs} />
        <Stat value={<AnimatedValue value={totalSessions} />}        label={s.sessions} />
      </div>
    </GlassSurface>
  )
}
