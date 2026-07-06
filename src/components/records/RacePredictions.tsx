import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { RacePrediction } from '@/application/usecases/GetRacePredictions'
import { formatDuration, formatPace } from '@/lib/formatters'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Tooltip } from '@/components/ui/Tooltip'
import { STATUS } from '@/lib/statusColors'
import { t } from '@/i18n'

const TREND_THRESHOLD_SECONDS = 2

function TrendLine({ deltaSeconds, weeks }: { deltaSeconds: number | null; weeks: number }) {
  if (deltaSeconds === null) return null
  const s = t.racePredictions

  if (Math.abs(deltaSeconds) < TREND_THRESHOLD_SECONDS) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Minus size={12} /> {s.trendFlat}
      </p>
    )
  }

  const improving = deltaSeconds < 0
  const Icon = improving ? TrendingDown : TrendingUp
  const text = improving
    ? s.trendFaster(formatDuration(Math.abs(deltaSeconds)), weeks)
    : s.trendSlower(formatDuration(Math.abs(deltaSeconds)), weeks)

  return (
    <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${improving ? STATUS.success.text : STATUS.warning.text}`}>
      <Icon size={12} /> {text}
    </p>
  )
}

interface Props {
  predictions: RacePrediction[]
}

export function RacePredictions({ predictions }: Props) {
  if (!predictions.length) return null

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <TrendingUp size={16} className="text-accent-text" />
        {t.racePredictions.title}
        <Tooltip content={t.racePredictions.formulaExplainer} className="normal-case tracking-normal text-subtle">
          <button type="button" className="font-normal underline decoration-dotted">
            {t.racePredictions.formulaLabel}
          </button>
        </Tooltip>
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {predictions.map(({ key, label, km, predictedSeconds, lowSeconds, highSeconds, actualSeconds, trendDeltaSeconds, trendWeeks }) => {
          const hasBand = highSeconds > lowSeconds
          return (
            <GlassSurface key={key} variant="card" className="rounded-card-sm p-5">
              <p className="text-xs font-semibold text-subtle">{label}</p>
              <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-foreground">
                {formatDuration(predictedSeconds)}
              </p>
              <p className="text-xs text-subtle">
                {formatPace(Math.round(predictedSeconds / km))}
                {hasBand && ` · ±${formatDuration(Math.round((highSeconds - lowSeconds) / 2))}`}
              </p>
              {actualSeconds != null && (
                <p className={`mt-0.5 text-xs font-medium ${STATUS.success.text}`}>
                  {actualSeconds <= predictedSeconds
                    ? t.racePredictions.beatBy(formatDuration(predictedSeconds - actualSeconds))
                    : t.racePredictions.pbUpside(formatDuration(actualSeconds - predictedSeconds))}
                </p>
              )}
              <TrendLine deltaSeconds={trendDeltaSeconds} weeks={trendWeeks} />
            </GlassSurface>
          )
        })}
      </div>
    </section>
  )
}
