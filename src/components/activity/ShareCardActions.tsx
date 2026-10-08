'use client'

import { Check, Copy, Download, Share2 } from 'lucide-react'
import { t } from '@/i18n'

interface Props {
  canShareFiles: boolean
  canCopyImage: boolean
  copyState: 'idle' | 'copied'
  /** Nothing to share yet: the Photo design before a photo is chosen. */
  disabled?: boolean
  onShare: () => void
  onSave: () => void
  onCopy: () => void
}

const BUTTON = {
  height: 52, borderRadius: 16, fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
} as const

/**
 * One row (v4.9), right under the option row: Share, or Download where the
 * browser can't share a file, in the accent with its own ink; Copy image
 * beside it where images can be copied, neutral, and still neutral once it
 * says Copied. Both grey out while there is nothing to share.
 */
export function ShareCardActions({ canShareFiles, canCopyImage, copyState, disabled = false, onShare, onSave, onCopy }: Props) {
  const copied = copyState === 'copied'
  return (
    <div
      className="grid shrink-0"
      style={{
        gridTemplateColumns: canCopyImage ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
        gap: 10,
        marginTop: 4,
      }}
    >
      <button
        onClick={canShareFiles ? onShare : onSave}
        disabled={disabled}
        style={{
          ...BUTTON, fontWeight: 700,
          background: disabled ? 'var(--muted)' : 'var(--accent)',
          color: disabled ? 'var(--muted-foreground)' : 'var(--accent-foreground)',
        }}
      >
        {canShareFiles ? <Share2 size={17} /> : <Download size={17} />}
        {canShareFiles ? t.activity.shareMenu.share : t.activity.shareMenu.download}
      </button>

      {canCopyImage && (
        <button
          onClick={onCopy}
          disabled={disabled}
          aria-live="polite"
          style={{
            ...BUTTON, fontWeight: 600, padding: '0 20px',
            background: 'var(--muted)', border: '1px solid var(--border)',
            color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)',
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
        </button>
      )}
    </div>
  )
}
