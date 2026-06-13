interface Props {
  aer: number | null
  ana: number | null
}

const LEVELS = [
  { max: 1.0, label: 'No benefit',        color: 'bg-gray-300 dark:bg-gray-600' },
  { max: 2.0, label: 'Minor',             color: 'bg-sky-400' },
  { max: 3.0, label: 'Maintaining',       color: 'bg-emerald-400' },
  { max: 4.0, label: 'Improving',         color: 'bg-amber-400' },
  { max: 4.8, label: 'Highly Improving',  color: 'bg-orange-500' },
  { max: 5.1, label: 'Overreaching',      color: 'bg-red-500' },
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Training Effect
      </h3>
      <div className="space-y-3">
        {aer != null && <TEBar value={aer} label="Aerobic" />}
        {ana != null && <TEBar value={ana} label="Anaerobic" />}
      </div>
    </div>
  )
}
