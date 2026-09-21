import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  aer: number | null
  ana: number | null
}

/**
 * Garmin's training-effect scale. A run scores on both axes at once, so the two
 * readings belong side by side rather than in a 1-or-2-column grid that changed
 * shape per activity.
 *
 * The qualifier word carries the position on the scale; the value colour carries
 * only whether there was an effect at all. A five-hue ramp on a 60px row put
 * blue, green, orange and red in one strip for a distinction the word already
 * makes.
 */
const LEVELS = [
  { max: 1.0, label: t.activity.trainingEffect.levels.noBenefit },
  { max: 2.0, label: t.activity.trainingEffect.levels.minor },
  { max: 3.0, label: t.activity.trainingEffect.levels.maintaining },
  { max: 4.0, label: t.activity.trainingEffect.levels.improving },
  { max: 4.8, label: t.activity.trainingEffect.levels.highlyImproving },
  { max: 5.1, label: t.activity.trainingEffect.levels.overreaching },
]

const NO_BENEFIT_BELOW = LEVELS[0]!.max

function getLevel(value: number) {
  return LEVELS.find((l) => value < l.max) ?? LEVELS[LEVELS.length - 1]!
}

function TECell({ value, label }: { value: number; label: string }) {
  const level = getLevel(value)
  const earned = value >= NO_BENEFIT_BELOW

  return (
    <div className="min-w-0 flex-1 px-3.5 py-2.5">
      <p className="font-mono text-micro font-semibold uppercase leading-none tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5 leading-tight">
        <span className={cn('text-body font-bold tabular-nums', earned ? STATUS.success.text : 'text-muted-foreground')}>
          {value.toFixed(1)}
        </span>
        <span className="truncate text-caption font-semibold text-subtle">{level.label}</span>
      </p>
    </div>
  )
}

// A zero is a reading, but it is not a finding: an axis the run did not touch
// costs half the row to say nothing. Show the axes the run actually scored on.
function scored(value: number | null): boolean {
  return value != null && value > 0
}

export function TrainingEffect({ aer, ana }: Props) {
  if (!scored(aer) && !scored(ana)) return null

  return (
    <GlassSurface variant="card" className="flex items-stretch divide-x divide-border p-0">
      {scored(aer) && <TECell value={aer!} label={t.activity.trainingEffect.aerobic} />}
      {scored(ana) && <TECell value={ana!} label={t.activity.trainingEffect.anaerobic} />}
    </GlassSurface>
  )
}
