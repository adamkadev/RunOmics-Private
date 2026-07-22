'use client'

import { Fragment } from 'react'
import type { ShareDesign, ThemeMode } from '@/lib/shareCard'
import { SHARE_DESIGNS } from '@/lib/shareCard'
import type { AccentId } from '@/lib/accent'
import { ThemeCard, ThemeDivider } from '@/components/activity/ShareCardThumbnails'
import { t } from '@/i18n'

interface Props {
  selectedDesign: ShareDesign
  accent: AccentId
  theme: ThemeMode
  accentHex: string
  customRgb?: [number, number, number]
  gpsRoute: Array<[number, number]> | null | undefined
  photoUrl: string | null
  onSelect: (design: ShareDesign) => void
}

/** Horizontal carousel of share-card design thumbnails. */
export function ShareThemePicker({
  selectedDesign, accent, theme, accentHex, customRgb, gpsRoute, photoUrl, onSelect,
}: Props) {
  // `route` is the activity's own trace on a real basemap: with no GPS there is
  // nothing to show, so it drops out the way any missing datum would.
  const designs = SHARE_DESIGNS.filter((d) => d !== 'route' || (gpsRoute?.length ?? 0) > 1)

  return (
    <div
      className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ padding: '4px 14px 12px' }}
    >
      {designs.map((d) => (
        <Fragment key={d}>
          {d === 'memory' && <ThemeDivider label={t.activity.shareCard.orUsePhoto} />}
          <ThemeCard
            design={d}
            accent={accent}
            theme={theme}
            selected={selectedDesign === d}
            accentHex={accentHex}
            onClick={() => onSelect(d)}
            gpsRoute={gpsRoute}
            photoUrl={d === 'memory' ? photoUrl : null}
            customRgb={customRgb}
          />
        </Fragment>
      ))}
    </div>
  )
}
