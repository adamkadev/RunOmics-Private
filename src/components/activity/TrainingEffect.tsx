import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Props {
  aer: number | null
  ana: number | null
}

const LEVELS = [
  { max: 1.0, label: t.activity.trainingEffect.levels.noBenefit,       color: 'bg-gray-300 dark:bg-gray-600' },
  { max: 2.0, label: t.activity.trainingEffect.levels.minor,           color: 'bg-sky-400' },
  { max: 3.0, label: t.activity.trainingEffect.levels.maintaining,     color: 'bg-emerald-400' },
  { max: 4.0, label: t.activity.trainingEffect.levels.improving,       color: 'bg-amber-400' },
  { max: 4.8, label: t.activity.trainingEffect.levels.highlyImproving, color: 'bg-orange-500' },
  { max: 5.1, label: t.activity.trainingEffect.levels.overreaching,    color: 'bg-red-500' },
]

function getLevel(value: number) {
  return LEVELS.find((l) => value < l.max) ?? LEVELS[LEVELS.length - 1]
}

function TEBar({ value, label }: { value: number; label: string }) {
  const level = getLevel(value)
  const pct = Math.min((value / 5) * 100, 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-subtle">{level.label}</span>
          <span className="w-6 text-right font-bold text-foreground tabular-nums">
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${level.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TrainingEffect({ aer, ana }: Props) {
  if (aer == null && ana == null) return null

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-[18px]">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.activity.trainingEffect.title}
      </h3>
      <div className="space-y-3">
        {aer != null && <TEBar value={aer} label={t.activity.trainingEffect.aerobic} />}
        {ana != null && <TEBar value={ana} label={t.activity.trainingEffect.anaerobic} />}
      </div>
    </GlassSurface>
  )
}
