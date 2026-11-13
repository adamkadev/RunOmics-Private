'use client'

import { Check, Copy, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  canShareFiles: boolean
  canCopyImage: boolean
  copyState: 'idle' | 'copied'
  /** Nothing to share yet: the Photo design before a photo is chosen. */
  disabled?: boolean
  /** A video shares as a file only: there is no video on the clipboard. */
  video?: boolean
  /** The video's encoding, in per cent; null when idle. */
  preparing?: number | null
  onShare: () => void
  onSave: () => void
  onCopy: () => void
}

export function ShareCardActions({
  canShareFiles, canCopyImage, copyState, disabled = false, video = false, preparing = null, onShare, onSave, onCopy,
}: Props) {
  const copied = copyState === 'copied'
  const copy = canCopyImage && !video
  const s = t.activity.shareCard
  const label = preparing !== null
    ? s.preparingVideo(preparing)
    : canShareFiles ? (video ? s.shareVideo : t.activity.shareMenu.share) : t.activity.shareMenu.download
  return (
    <div data-testid="share-actions" className={cn('grid shrink-0 gap-2.5 pt-3', copy ? 'grid-cols-2' : 'grid-cols-1')}>
      <Button
        size="lg"
        onClick={video || canShareFiles ? onShare : onSave}
        disabled={disabled || preparing !== null}
        aria-live={video ? 'polite' : undefined}
        className="gap-2"
      >
        {canShareFiles ? <Share2 size={18} /> : <Download size={18} />}
        {label}
      </Button>

      {copy && (
        // Disabled as Share is, grey fill and muted ink, so the two read as one state.
        <Button
          size="lg"
          variant="secondary"
          onClick={onCopy}
          disabled={disabled}
          aria-live="polite"
          className="gap-2 disabled:text-muted-foreground disabled:opacity-100"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
        </Button>
      )}
    </div>
  )
}
