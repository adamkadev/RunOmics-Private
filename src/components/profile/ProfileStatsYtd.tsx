import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import type { ProfileYtdStats } from '@/application/usecases/GetProfileData'
import { t } from '@/i18n'

interface Cell {
  value: ReactNode
  unit?: string
  label: string
}

export function ProfileStatsYtd({ ytd }: { ytd: ProfileYtdStats }) {
  const cells: Cell[] = [
    { value: <AnimatedValue value={ytd.distanceKm} />, unit: t.units.km, label: t.profile.ytd.distance },
    { value: <AnimatedValue value={Math.round(ytd.durationSeconds / 3600)} />, unit: t.units.hour, label: t.profile.ytd.duration },
    { value: <AnimatedValue value={ytd.sessionCount} />, label: t.profile.ytd.sessions },
    { value: <>+<AnimatedValue value={ytd.elevationGainM} /></>, unit: t.units.m, label: t.profile.ytd.elevation },
  ]

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="mb-3 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
        {t.profile.ytd.title}
      </div>
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-3.5">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              i < 2 && 'border-b border-foreground/[0.07] pb-3.5',
              i % 2 === 1 && 'border-l border-foreground/[0.07] pl-3.5'
            )}
          >
            <div className="flex items-baseline gap-1">
              <span className="text-title2 font-extrabold tracking-tight text-foreground">{cell.value}</span>
              {cell.unit && <span className="text-caption font-semibold text-muted-foreground">{cell.unit}</span>}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">{cell.label}</div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
