import { siGarmin } from 'simple-icons'
import { t } from '@/i18n'

/** The Garmin mark on an inset tile, the device row's icon. */
export function GarminTile() {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-[var(--surface-2)]">
      <svg role="img" viewBox="0 0 24 24" width={28} height={28} fill="currentColor" className="text-foreground">
        <title>{t.settings.dataSource.garmin}</title>
        <path d={siGarmin.path} />
      </svg>
    </div>
  )
}

/** "● Connected" in pos: the source is live (v4.17). */
export function ConnectedMark() {
  return (
    <span className="whitespace-nowrap text-[var(--pos)]" data-testid="garmin-connected">
      <span aria-hidden className="mr-1 inline-block size-1.5 -translate-y-px rounded-full bg-[var(--pos)] align-middle" />
      {t.settings.dataSource.connectedNow}
    </span>
  )
}
