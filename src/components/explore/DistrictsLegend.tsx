import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Each swatch is a step more opaque than its fill on the map, so it reads at 10 pt. */
const SWATCH = {
  fog: 'border border-dashed bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)] border-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)] dark:bg-[color-mix(in_srgb,var(--background)_80%,transparent)]',
  partly:
    'border bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] border-[color:color-mix(in_srgb,var(--foreground)_30%,transparent)] dark:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] dark:border-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)]',
  // Light mono's accent is near-black and a wash of it reads as the fog's grey, so the swatch lifts to the capsule's paper, as on the map.
  complete:
    'border-[1.5px] border-accent bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] dark:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] [:root[data-accent=mono]:not(.dark)_&]:bg-[var(--raised)]',
} as const

/** Solid, not glass, for the blur budget; in dark the drop is lost on the map, so it takes the solid glass's hairline rim. */
export function DistrictsLegend({ className }: { className?: string }) {
  const d = t.pages.map.districts
  const items = [
    { key: 'fog', label: d.fog },
    { key: 'partly', label: d.partly },
    { key: 'complete', label: d.complete },
  ] as const
  return (
    <div
      data-testid="districts-legend"
      role="list"
      aria-label={d.legend}
      className={cn(
        'flex h-9 items-center gap-3 rounded-full bg-[var(--raised)] px-3.5 text-[13px] text-foreground shadow-[var(--glass-drop)] dark:shadow-[inset_0_0_0_1px_var(--border),var(--glass-drop)]',
        className,
      )}
    >
      {items.map(({ key, label }) => (
        <span key={key} role="listitem" className="flex items-center gap-[5px] whitespace-nowrap">
          <span aria-hidden="true" data-swatch={key} className={`box-border size-2.5 shrink-0 rounded-[3px] ${SWATCH[key]}`} />
          {label}
        </span>
      ))}
    </div>
  )
}
