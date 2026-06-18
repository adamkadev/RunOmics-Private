'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getClientAuth } from '@/lib/firebase'
import { t } from '@/i18n'
import { AthleteForm } from './AthleteForm'
import { GoalsForm } from './GoalsForm'
import { PbsForm } from './PbsForm'

const OWNER_EMAIL = 'adam.elkadaoui@gmail.com'

export function SettingsClient() {
  const [user, setUser] = useState<User | null | 'loading'>('loading')

  useEffect(() => {
    const auth = getClientAuth()
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  async function handleSignIn() {
    const auth = getClientAuth()
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function handleSignOut() {
    await signOut(getClientAuth())
  }

  if (user === 'loading') {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.settings.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
        </div>
        <button
          onClick={handleSignIn}
          className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          {t.settings.auth.signIn}
        </button>
      </div>
    )
  }

  if (user.email !== OWNER_EMAIL) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.settings.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.settings.subtitle}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.settings.auth.signOut}
        </button>
      </div>

      <AthleteForm />
      <GoalsForm />
      <PbsForm />
    </div>
  )
}
