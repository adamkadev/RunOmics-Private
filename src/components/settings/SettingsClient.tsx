'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BackButton } from '@/components/ui/BackButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { DataSourceInfo, type SyncDevice } from './DataSourceInfo'
import { NotificationsForm } from './NotificationsForm'

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? ''

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
}

export function SettingsClient({ lastSyncedAt, activityCount, device }: Props) {
  // Without the public Firebase config, start signed-out (theme/accent
  // settings still work) instead of spinning forever waiting for auth.
  const [user, setUser] = useState<User | null | 'loading'>(
    isClientFirebaseConfigured ? 'loading' : null
  )
  const [signingIn, setSigningIn] = useState(false)
  const { toast, leaving, showToast } = useToast()

  useEffect(() => {
    if (!isClientFirebaseConfigured) return
    const auth = getClientAuth()
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  async function handleSignIn() {
    if (!isClientFirebaseConfigured) {
      showToast(t.settings.auth.notConfigured, false)
      return
    }
    setSigningIn(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(getClientAuth(), provider)
    } catch (err) {
      // Ignore the user closing/cancelling the popup themselves.
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in failed:', err)
        showToast(t.settings.auth.error, false)
      }
    } finally {
      setSigningIn(false)
    }
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

        <section className="space-y-2">
          <h2 className="px-1 text-micro font-medium uppercase tracking-[0.08em] text-accent-text">
            {t.settings.sections.appearance}
          </h2>
          <GlassSurface variant="card" className="p-5">
            <AccentPicker />
            <div className="my-5 h-px bg-foreground/[0.06]" />
            <ThemeSegmented />
          </GlassSurface>
        </section>

        <div className="flex flex-col items-center gap-6 px-4 py-8">
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 active:bg-accent/80 disabled:opacity-60"
          >
            {signingIn ? t.settings.auth.signingIn : t.settings.auth.signIn}
          </button>
        </div>

        <Toast toast={toast} leaving={leaving} />
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
          className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-red-400 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-400"
        >
          {t.settings.auth.switchAccount}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
      <div>
        <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-micro font-medium uppercase tracking-[0.08em] text-accent-text">
          {t.settings.sections.appearance}
        </h2>
        <GlassSurface variant="card" className="p-5">
          <AccentPicker />
          <div className="my-5 h-px bg-foreground/[0.06]" />
          <ThemeSegmented />
        </GlassSurface>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-micro font-medium uppercase tracking-[0.08em] text-subtle-2">
          {t.settings.sections.notificationsData}
        </h2>
        <NotificationsForm />
        <DataSourceInfo lastSyncedAt={lastSyncedAt} activityCount={activityCount} device={device} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-micro font-medium uppercase tracking-[0.08em] text-subtle-2">
          {t.settings.sections.account}
        </h2>
        <button
          onClick={handleSignOut}
          className="w-full rounded-card-sm border border-destructive/40 py-3.5 text-sm font-semibold
                     text-destructive transition-colors hover:bg-destructive/[0.06] active:scale-[0.98]"
        >
          {t.settings.auth.signOut}
        </button>
      </section>
    </div>
  )
}
