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
  onShare: () => void
  onSave: () => void
  onCopy: () => void
}

export function ShareCardActions({ canShareFiles, canCopyImage, copyState, disabled = false, onShare, onSave, onCopy }: Props) {
  const copied = copyState === 'copied'
  return (
    <div className={cn('mt-1 grid shrink-0 gap-2.5', canCopyImage ? 'grid-cols-2' : 'grid-cols-1')}>
      <Button size="lg" onClick={canShareFiles ? onShare : onSave} disabled={disabled} className="gap-2">
        {canShareFiles ? <Share2 size={18} /> : <Download size={18} />}
        {canShareFiles ? t.activity.shareMenu.share : t.activity.shareMenu.download}
      </Button>

      {canCopyImage && (
        <Button size="lg" variant="secondary" onClick={onCopy} disabled={disabled} aria-live="polite" className="gap-2">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? t.activity.shareMenu.copied : t.activity.shareMenu.copy}
        </Button>
      )}
    </div>
  )
}
