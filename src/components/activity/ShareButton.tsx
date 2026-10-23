'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Share } from 'lucide-react'
import type { ShareActivity } from '@/lib/shareCardStats'
import { GLASS_GROUP_BUTTON } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

// Loaded on the first tap: the modal brings the canvas renderer and the map
// snapshot code with it.
const ShareCardModal = dynamic(() => import('./ShareCardModal').then((m) => m.ShareCardModal), { ssr: false })

interface Props {
  activity: ShareActivity
}

export function ShareButton({ activity }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [canShareFiles] = useState(
    () => typeof window !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  )
  const [canCopyImage] = useState(
    () => typeof window !== 'undefined' && typeof navigator.clipboard?.write === 'function' && typeof window.ClipboardItem !== 'undefined'
  )

  return (
    <>
      {/* Once the hero has scrolled away, the compact title bar's share icon
          presses this button (data-bar-action). */}
      <button
        type="button"
        data-bar-action="share"
        aria-label={t.activity.share}
        onClick={() => setIsOpen(true)}
        className={GLASS_GROUP_BUTTON}
      >
        <Share size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {isOpen && (
        <ShareCardModal
          activity={activity}
          canShareFiles={canShareFiles}
          canCopyImage={canCopyImage}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
