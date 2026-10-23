import { ChevronRight } from 'lucide-react'
import { RUN_CHART_LINE } from '@/lib/colors'
import { formatDistance } from '@/lib/formatters'
import { t } from '@/i18n'

const W = 100
const H = 64
const PAD = 2
/** Pace and heart rate in lanes of their own: drawn over each other, the two lines tangle into one. */
const LANE_GAP = 8
const LANE_H = (H - LANE_GAP) / 2

function path(samples: number[], invert: boolean, top: number): string | null {
  const points = samples.filter((value) => Number.isFinite(value) && value > 0)
  if (points.length < 2) return null
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const span = hi - lo || 1
  return points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * W
      const share = (value - lo) / span
      const y = top + PAD + (invert ? share : 1 - share) * (LANE_H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function PaceHrPreview({
  paceSamples,
  hrSamples,
  distanceKm,
  onShowCharts,
}: {
  paceSamples: number[] | null
  hrSamples: number[] | null
  distanceKm: number
  onShowCharts?: () => void
}) {
  const s = t.activity.pacePreview
  const pace = paceSamples ? path(paceSamples, true, 0) : null
  const hr = hrSamples ? path(hrSamples, false, pace ? LANE_H + LANE_GAP : 0) : null
  if (!pace && !hr) return null

  return (
    <section className="flex flex-col gap-1.5" data-testid="pace-hr-preview">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] font-semibold text-foreground">
          {s.title}
          <span aria-hidden className="text-[11px] font-normal text-muted-foreground">
            <span style={{ color: RUN_CHART_LINE.pace }}>{s.pace}</span>
            {' · '}
            <span style={{ color: RUN_CHART_LINE.hr }}>{s.hr}</span>
          </span>
        </h3>
        {onShowCharts && (
          <button type="button" onClick={onShowCharts} className="hit-44 inline-flex items-center gap-0.5 text-[11.5px] font-medium text-accent-text">
            {s.openCharts}
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${pace && hr ? H : LANE_H}`}
        preserveAspectRatio="none"
        className={pace && hr ? 'h-[64px] w-full' : 'h-[28px] w-full'}
        role="img"
        aria-label={s.title}
      >
        {pace && <path d={pace} fill="none" stroke={RUN_CHART_LINE.pace} strokeWidth="1.4" vectorEffect="non-scaling-stroke" data-testid="preview-pace" />}
        {hr && <path d={hr} fill="none" stroke={RUN_CHART_LINE.hr} strokeWidth="1.4" vectorEffect="non-scaling-stroke" data-testid="preview-hr" />}
      </svg>
      <div aria-hidden className="flex justify-between text-[11px] leading-none text-muted-foreground" data-testid="preview-ends">
        <span>{s.start}</span>
        <span>{`${formatDistance(distanceKm)} ${t.units.km}`}</span>
      </div>
    </section>
  )
}
