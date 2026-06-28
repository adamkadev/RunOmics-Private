'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { getClientAuth } from '@/lib/firebase'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BackButton } from '@/components/ui/BackButton'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { DataSourceInfo } from './DataSourceInfo'
import { NotificationsForm } from './NotificationsForm'

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ''

export function SettingsClient() {
  const [user, setUser] = useState<User | null | 'loading'>('loading')

  useEffect(() => {
    const auth = getClientAuth()
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  async function handleSignIn() {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(getClientAuth(), provider)
  }

  async function handleSignOut() {
    await signOut(getClientAuth())
  }

  if (user === 'loading') {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-accent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
        <div>
          <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
        </div>

        <GlassSurface variant="card" className="p-5">
          <AccentPicker />
        </GlassSurface>

        <div className="flex flex-col items-center gap-6 px-4 py-8">
          <button
            onClick={handleSignIn}
            className="flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 active:bg-accent/80"
          >
            {t.settings.auth.signIn}
          </button>
        </div>
      </div>
    )
  }

  if (user.email !== OWNER_EMAIL) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
        <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
        <p className="text-center text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-red-400 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-400"
        >
          <LogOut size={16} />
          {t.settings.auth.switchAccount}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-[max(env(safe-area-inset-bottom),80px)]">
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
      <div>
        <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
      </div>

      <GlassSurface variant="card" className="p-5">
        <AccentPicker />
        <div className="my-5 h-px bg-foreground/[0.06]" />
        <ThemeSegmented />
      </GlassSurface>

      <NotificationsForm />
      <DataSourceInfo />

      <button
        onClick={handleSignOut}
        className="w-full rounded-card-sm border border-destructive/40 py-4 text-base font-semibold
                   text-destructive transition-colors hover:bg-destructive/[0.06] active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <LogOut size={18} />
          {t.settings.auth.signOut}
        </span>
      </button>
    </div>
  )
}
