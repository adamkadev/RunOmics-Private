'use client'

import { useState, type ReactNode } from 'react'
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { SIGN_IN_PATH, endSiteSession, replacePage } from '@/lib/siteSession'
import { formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { Toast, useToast } from '@/components/ui/Toast'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { DataSourceInfo, type SyncDevice } from './DataSourceInfo'
import { ConnectedMark, GarminTile } from './GarminMark'
import { NotificationsForm } from './NotificationsForm'
import { BuildInfo } from './BuildInfo'
import { bodyMetrics } from '@/components/profile/ProfileAthleteStats'

interface Body {
  heightCm?: number
  weightKg?: number
  bmi?: number
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  /** Height, weight and BMI from Garmin: moved here from Athlete (C2, v4.4). */
  body?: Body
}

export function SettingsClient({ lastSyncedAt, activityCount, device, body }: Props) {
  const { user, isOwner, loading } = useOwnerAuth()
  const [signingIn, setSigningIn] = useState(false)
  const { toast, leaving, showToast } = useToast()

  async function handleSignIn() {
    if (!isClientFirebaseConfigured) {
      showToast(t.settings.auth.notConfigured, false)
      return
    }
    setSigningIn(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const auth = getClientAuth()
      // Google's own sign-in window, in the app's language.
      auth.languageCode = t.locale
      await signInWithPopup(auth, provider)
    } catch (err) {
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
    // The private site's session first: on a private site, signing out ends
    // at /sign-in, and the pages this device cached go too.
    const site = await endSiteSession()
    await signOut(getClientAuth())
    if (site.private) replacePage(SIGN_IN_PATH)
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-accent" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3.5">
        <SettingsHeader />
        <AppearanceSection />
        <ProfileSection body={body} />

        {/* Signed out, the page still says where the data comes from and what
            signing in unlocks, instead of ending on a bare button. The sync
            is the owner's, so there is no Sync now here. */}
        <Section title={t.settings.sections.data}>
          <div className={cardClass({ padding: 'none', className: 'px-5' })}>
            <div className="flex items-center gap-3.5 border-b border-border py-4" data-testid="garmin-row">
              <GarminTile />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{device?.name ?? t.settings.dataSource.garmin}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {lastSyncedAt && (
                    <>
                      <ConnectedMark />
                      {' · '}
                    </>
                  )}
                  {lastSyncedAt
                    ? t.settings.dataSource.readOnlySynced(formatRelativeAgo(lastSyncedAt), t.common.runs(activityCount))
                    : t.settings.dataSource.readOnly}
                </p>
              </div>
            </div>
            {/* The hub promises export, so the row is here signed out too; the
                workbook is owner-only, so it asks for the sign-in first. */}
            <button type="button" onClick={handleSignIn} className="flex w-full items-center justify-between gap-3 py-3.5 text-left">
              <span className="min-w-0">
                <span className="block text-sm text-foreground">{t.settings.dataExport.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.settings.dataExport.signedOut(t.common.runs(activityCount))}</span>
              </span>
              <span className="shrink-0 text-[13px] font-medium text-accent-text">{t.settings.rowAction.signIn}</span>
            </button>
          </div>
        </Section>

        <Section title={t.settings.sections.notifications}>
          <div className={cardClass({ className: 'flex flex-col gap-3.5' })}>
            <p className="text-sm text-muted-foreground">{t.settings.auth.signInToManage}</p>
            <Button variant="primary" onClick={handleSignIn} disabled={signingIn} className="h-11 w-full rounded-xl text-sm">
              {signingIn ? t.settings.auth.signingIn : t.settings.auth.signIn}
            </Button>
          </div>
        </Section>

        <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
        <Toast toast={toast} leaving={leaving} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
        <BackButton label={t.pages.settings.back} fallbackHref="/profile" className="lg:hidden" />
        <p className="text-center text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
        <Button variant="secondary" onClick={handleSignOut} className="h-11 rounded-xl px-4 text-sm font-medium">
          {t.settings.auth.switchAccount}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <SettingsHeader />
      <AppearanceSection />
      <ProfileSection body={body} />

      <Section title={t.settings.sections.data}>
        <DataSourceInfo lastSyncedAt={lastSyncedAt} activityCount={activityCount} device={device} user={user} />
      </Section>

      <Section title={t.settings.sections.notifications}>
        <NotificationsForm />
      </Section>

      {/* Sign out is an outline button: a real action, but not the page's one (v4.17). */}
      <Button variant="secondary" onClick={handleSignOut} className="mt-1.5 h-11 w-full rounded-xl text-sm font-normal">
        {t.settings.auth.signOut}
      </Button>

      <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}

function SettingsHeader() {
  return (
    <header className="mb-1.5">
      {/* Settings is a sidebar row on a wide screen: the way back is on a phone only. */}
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" className="mb-3.5 lg:hidden" />
      <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
    </header>
  )
}

/** A group of settings: its eyebrow, then its card. */
function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-2.5" data-testid={testId}>
      <SectionDivider as="h2" className="px-1">
        {title}
      </SectionDivider>
      {children}
    </section>
  )
}

/** A setting's name and what it does, with its control on the right (under it on a phone). */
function SettingRow({ title, hint, children, stack = false }: { title: string; hint: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-x-4 gap-y-3 border-b border-border py-3.5 last:border-b-0', stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}

/** The settings that are the user's own (v4.17): the theme first, then the accent. */
function AppearanceSection() {
  return (
    <Section title={t.settings.sections.appearance}>
      <div className={cardClass({ padding: 'none', className: 'px-5 py-1.5' })} data-testid="settings-appearance">
        <SettingRow title={t.settings.appearance.themeLabel} hint={t.settings.appearance.themeHint}>
          <ThemeSegmented />
        </SettingRow>
        <SettingRow title={t.settings.accent.title} hint={t.settings.accent.hint} stack>
          <AccentPicker />
        </SettingRow>
      </div>
    </Section>
  )
}

/**
 * Height, weight and BMI, as Garmin has them: read-only rows, drawn as facts
 * (design review, Oct 2026). The value is quiet on the right, where the
 * page's actions sit in colour, with no chevron; the line under the card says
 * where they change, so nobody taps them to find out.
 */
function ProfileSection({ body }: { body?: Body }) {
  const rows = body ? bodyMetrics(body) : []
  if (rows.length === 0) return null
  return (
    <Section title={t.settings.sections.profile} testId="settings-profile">
      <div className={cardClass({ padding: 'none', className: 'px-5' })}>
        <dl>
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-3.5 text-sm last:border-b-0">
              <dt className="text-foreground">{row.label}</dt>
              <dd className="text-muted-foreground" data-testid="profile-value">
                {row.value}
                {row.unit && <span className="ml-1">{row.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="px-1 text-xs leading-snug text-muted-foreground">{t.settings.profile.readOnly}</p>
    </Section>
  )
}
