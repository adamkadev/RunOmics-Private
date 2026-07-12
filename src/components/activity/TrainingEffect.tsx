import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  aer: number | null
  ana: number | null
}

const LEVELS = [
  { max: 1.0, label: t.activity.trainingEffect.levels.noBenefit,       textClass: 'text-subtle' },
  { max: 2.0, label: t.activity.trainingEffect.levels.minor,           textClass: 'text-blue-500 dark:text-blue-400' },
  { max: 3.0, label: t.activity.trainingEffect.levels.maintaining,     textClass: 'text-accent-text' },
  { max: 4.0, label: t.activity.trainingEffect.levels.improving,       textClass: 'text-accent-text' },
  { max: 4.8, label: t.activity.trainingEffect.levels.highlyImproving, textClass: 'text-orange-500 dark:text-orange-400' },
  { max: 5.1, label: t.activity.trainingEffect.levels.overreaching,    textClass: 'text-red-500 dark:text-red-400' },
]

function getLevel(value: number) {
  // LEVELS is a fixed non-empty literal, so the last element always exists.
  return LEVELS.find((l) => value < l.max) ?? LEVELS[LEVELS.length - 1]!
}

function TETile({ value, label }: { value: number; label: string }) {
  const level = getLevel(value)

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-3.5 text-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-base font-extrabold tabular-nums', level.textClass)}>{value.toFixed(1)} · {level.label}</p>
    </div>
  )
}

export function TrainingEffect({ aer, ana }: Props) {
  const effectsCount = [aer, ana].filter((v) => v != null && v !== 0).length
  if (effectsCount === 0) return null

  return (
    <div className={cn(
      'grid gap-3',
      effectsCount === 1 ? 'grid-cols-1' : 'grid-cols-2'
    )}>
      {aer != null && aer !== 0 && (
        <TETile value={aer} label={t.activity.trainingEffect.aerobic} />
      )}
      {ana != null && ana !== 0 && (
        <TETile value={ana} label={t.activity.trainingEffect.anaerobic} />
      )}
    </div>
  )
}
