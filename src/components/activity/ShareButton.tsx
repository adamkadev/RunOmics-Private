'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Share } from 'lucide-react'
import type { ShareActivity } from '@/lib/shareCardStats'
import { GLASS_GROUP_BUTTON } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

// The modal brings the 800-line canvas renderer and the map snapshot code
// with it. It is only ever drawn after a tap, so it loads then.
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
      {/* The page's one action, in the hero's clear-glass group beside
          expand (Liquid Glass v3, G13). Once the hero has scrolled away, the
          compact title bar's share icon presses it (design review, Oct 2026). */}
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
