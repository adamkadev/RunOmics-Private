import { siGarmin } from 'simple-icons'
import { t } from '@/i18n'

/** The Garmin mark on an inset tile, the device row's icon. */
export function GarminTile() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-[var(--surface-2)]">
      <svg role="img" viewBox="0 0 24 24" width={28} height={28} fill="currentColor" className="text-foreground">
        <title>{t.settings.dataSource.garmin}</title>
        <path d={siGarmin.path} />
      </svg>
    </div>
  )
}

/**
 * The green dot before the sync line (3.0 1i): the source is live. The word
 * is for a screen reader; on screen the dot says it.
 */
export function ConnectedMark() {
  return (
    <span className="text-[var(--pos)]" data-testid="garmin-connected">
      <span aria-hidden className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-[var(--pos)] align-middle" />
      <span className="sr-only">{t.settings.dataSource.connectedNow} · </span>
    </span>
  )
}
