'use client'

import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { loadAuth } from '@/lib/loadAuth'
import { openSiteSession, replacePage, safeNextPath } from '@/lib/siteSession'
import { HeaderMark } from '@/components/layout/HeaderMark'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'

type Phase =
  /** Firebase is reading the account this browser last signed in with. */
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'signingIn' }
  /** Trading the account's token for the session cookie. */
  | { kind: 'opening' }
  | { kind: 'notInvited'; email: string | null }
  | { kind: 'unavailable' }
  | { kind: 'failed' }

async function openSite(account: User, setPhase: (phase: Phase) => void) {
  setPhase({ kind: 'opening' })
  let token: string
  try {
    // Fresh, so a claim granted since the last sign-in counts now.
    token = await account.getIdToken(true)
  } catch {
    setPhase({ kind: 'failed' })
    return
  }
  const answer = await openSiteSession(token)
  if (answer === 'open') {
    // A full load, so the proxy reads the new cookie and the app starts whole.
    replacePage(safeNextPath(new URLSearchParams(window.location.search).get('next')))
    return
  }
  setPhase(answer === 'notInvited' ? { kind: 'notInvited', email: account.email } : { kind: answer })
}

/** The private site's one public page: an account Firebase still holds opens the site without a tap, so the monthly session renewal looks like a short load. */
export function SignInClient() {
  const [phase, setPhase] = useState<Phase>(isClientFirebaseConfigured ? { kind: 'loading' } : { kind: 'unavailable' })
  const user = useRef<User | null>(null)

  useEffect(() => {
    if (!isClientFirebaseConfigured) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    loadAuth({ forSignIn: true })
      .then(({ onAuthStateChanged, auth }) => {
        if (cancelled) return
        unsubscribe = onAuthStateChanged(auth, (account) => {
          user.current = account
          if (account) void openSite(account, setPhase)
          else setPhase({ kind: 'signedOut' })
        })
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: 'unavailable' })
      })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  async function signIn() {
    setPhase({ kind: 'signingIn' })
    try {
      const { auth, GoogleAuthProvider, browserPopupRedirectResolver, signInWithPopup } = await loadAuth({ forSignIn: true })
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      auth.languageCode = t.locale
      // The account arrives through onAuthStateChanged, which opens the site.
      await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') setPhase({ kind: 'signedOut' })
      else setPhase({ kind: 'failed' })
    }
  }

  async function otherAccount() {
    const { auth, signOut } = await loadAuth()
    await signOut(auth)
  }

  function retry() {
    if (user.current) void openSite(user.current, setPhase)
    else void signIn()
  }

  const busy = phase.kind === 'loading' || phase.kind === 'opening'

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-[calc(2rem+var(--safe-bottom))] pt-[var(--top-scrim)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center" data-testid="sign-in" data-phase={phase.kind}>
        <HeaderMark size={44} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title2 font-bold tracking-[-0.01em] text-foreground">{t.signIn.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.signIn.lead}</p>
        </div>

        <div className="flex min-h-24 w-full flex-col items-center justify-center gap-3" aria-live="polite">
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-accent" />
              {t.signIn.opening}
            </p>
          )}

          {(phase.kind === 'signedOut' || phase.kind === 'signingIn') && (
            <Button variant="primary" onClick={signIn} disabled={phase.kind === 'signingIn'} className="h-11 w-full rounded-xl text-sm">
              {phase.kind === 'signingIn' ? t.settings.auth.signingIn : t.settings.auth.signIn}
            </Button>
          )}

          {phase.kind === 'notInvited' && (
            <>
              <p className="text-sm text-foreground">{t.signIn.notInvited(phase.email)}</p>
              <Button variant="secondary" onClick={otherAccount} className="h-11 w-full rounded-xl text-sm">
                {t.signIn.otherAccount}
              </Button>
            </>
          )}

          {phase.kind === 'failed' && (
            <>
              <p className="text-sm text-foreground">{t.settings.auth.error}</p>
              <Button variant="primary" onClick={retry} className="h-11 w-full rounded-xl text-sm">
                {t.signIn.retry}
              </Button>
            </>
          )}

          {phase.kind === 'unavailable' && <p className="text-sm text-foreground">{t.signIn.unavailable}</p>}
        </div>
      </div>
    </div>
  )
}
