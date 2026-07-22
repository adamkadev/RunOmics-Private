'use client'

import { ACCENT_IDS, ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import type { ShareAccent } from '@/lib/useShareCardPrefs'
import { SHARE_CARD_COLORS } from '@/lib/colors'

interface Props {
  shareAccent: ShareAccent
  customHex: string
  onSelectAccent: (id: AccentId) => void
  onSelectCustom: (hex: string) => void
}

/** Row of accent color dots plus a rainbow "custom color" dot backed by <input type=color>. */
export function ShareAccentPicker({ shareAccent, customHex, onSelectAccent, onSelectCustom }: Props) {
  return (
    <div className="flex items-center" style={{ gap: 5 }}>
      {ACCENT_IDS.map((id) => {
        const selected = shareAccent === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectAccent(id)}
            aria-label={id}
            style={{
              width: 18, height: 18, borderRadius: '50%',
              background: ACCENT_SWATCHES[id],
              border: selected ? 'none' : '1.5px solid color-mix(in srgb, var(--ro-text) 20%, transparent)',
              boxShadow: selected
                ? `0 0 0 2.5px var(--background), 0 0 0 4.5px ${ACCENT_SWATCHES[id]}40`
                : 'none',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
          />
        )
      })}
      <label style={{ position: 'relative', width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}>
        <span
          style={{
            display: 'block', width: 18, height: 18, borderRadius: '50%',
            background: shareAccent === 'custom'
              ? customHex
              : SHARE_CARD_COLORS.customWheel,
            border: shareAccent === 'custom' ? 'none' : '1.5px solid color-mix(in srgb, var(--ro-text) 20%, transparent)',
            boxShadow: shareAccent === 'custom'
              ? `0 0 0 2.5px var(--background), 0 0 0 4.5px ${customHex}40`
              : 'none',
          }}
        />
        <input
          type="color"
          value={customHex}
          onChange={(e) => onSelectCustom(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </label>
    </div>
  )
}
