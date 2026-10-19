import { ChevronRight } from 'lucide-react'
import { t } from '@/i18n'

const W = 100
const H = 54
const PAD = 3

function path(samples: number[], invert: boolean): string | null {
  const points = samples.filter((value) => Number.isFinite(value) && value > 0)
  if (points.length < 2) return null
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const span = hi - lo || 1
  return points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * W
      const share = (value - lo) / span
      const y = PAD + (invert ? share : 1 - share) * (H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function PaceHrPreview({
  paceSamples,
  hrSamples,
  onShowCharts,
}: {
  paceSamples: number[] | null
  hrSamples: number[] | null
  onShowCharts?: () => void
}) {
  const s = t.activity.pacePreview
  const pace = paceSamples ? path(paceSamples, true) : null
  const hr = hrSamples ? path(hrSamples, false) : null
  if (!pace && !hr) return null

  return (
    <section className="flex flex-col gap-1.5" data-testid="pace-hr-preview">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] font-semibold text-foreground">
          {s.title}
          <span aria-hidden className="text-[11px] font-normal text-muted-foreground">
            <span style={{ color: 'var(--accent-text)' }}>{s.pace}</span>
            {' · '}
            <span className="text-foreground">{s.hr}</span>
          </span>
        </h3>
        {onShowCharts && (
          <button type="button" onClick={onShowCharts} className="hit-44 inline-flex items-center gap-0.5 text-[11.5px] font-medium text-accent-text">
            {s.openCharts}
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[54px] w-full" role="img" aria-label={s.title}>
        {pace && <path d={pace} fill="none" stroke="var(--accent)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />}
        {hr && <path d={hr} fill="none" stroke="var(--foreground)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />}
      </svg>
    </section>
  )
}
