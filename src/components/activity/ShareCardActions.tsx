'use client'

import { Check, Copy, Download, Share2 } from 'lucide-react'
import { SHARE_CARD_COLORS } from '@/lib/colors'
import { t } from '@/i18n'

interface Props {
  canShareFiles: boolean
  canCopyImage: boolean
  accentHex: string
  copyState: 'idle' | 'copied'
  onShare: () => void
  onSave: () => void
  onCopy: () => void
}

/** Bottom action row: native share (or download fallback) + copy-to-clipboard. */
export function ShareCardActions({ canShareFiles, canCopyImage, accentHex, copyState, onShare, onSave, onCopy }: Props) {
  return (
    <div
      className="grid shrink-0 gap-2.5"
      style={{
        gridTemplateColumns: canCopyImage ? '1fr 1fr' : '1fr',
        padding: '12px 16px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      {canShareFiles ? (
        <button
          onClick={onShare}
          style={{
            height: 46, borderRadius: 14, border: 'none',
            background: accentHex, color: SHARE_CARD_COLORS.onAccent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}
        >
          <Share2 size={15} />
          {t.activity.shareMenu.share}
        </button>
      ) : (
        <button
          onClick={onSave}
          style={{
            height: 46, borderRadius: 14, border: '1px solid var(--glass-border)',
            background: 'color-mix(in srgb, var(--ro-text) 9%, transparent)', color: 'var(--ro-text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Download size={15} />
          {t.activity.shareMenu.download}
        </button>
      )}

      {canCopyImage && (
        <button
          onClick={onCopy}
          style={{
            height: 46, borderRadius: 14, border: '1px solid var(--glass-border)',
            background: 'color-mix(in srgb, var(--ro-text) 9%, transparent)',
            color: copyState === 'copied' ? accentHex : 'var(--ro-text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'color 0.2s',
          }}
        >
          {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
          {copyState === 'copied' ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
        </button>
      )}
    </div>
  )
}
