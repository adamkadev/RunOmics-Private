'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { getClientAuth } from '@/lib/firebase'
import { t } from '@/i18n'
import { AccentPicker } from './AccentPicker'
import { AthleteForm } from './AthleteForm'
import { GoalsForm } from './GoalsForm'
import { PbsForm } from './PbsForm'
import { UpcomingRacesForm } from './UpcomingRacesForm'

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
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.settings.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
        </div>

        <AccentPicker />

        <div className="flex flex-col items-center gap-6 px-4 py-8">
          <button
            onClick={handleSignIn}
            className="flex items-center gap-2.5 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 active:bg-accent/80"
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
        <p className="text-center text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-400 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-400"
        >
          <LogOut size={13} />
          {t.settings.auth.switchAccount}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.settings.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-400 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-400"
        >
          <LogOut size={13} />
          {t.settings.auth.signOut}
        </button>
      </div>

      <AccentPicker />

      <AthleteForm />
      <GoalsForm />
      <UpcomingRacesForm />
      <PbsForm />
    </div>
  )
}
