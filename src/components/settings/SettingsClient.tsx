'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BackButton } from '@/components/ui/BackButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { DataSourceInfo, type SyncDevice } from './DataSourceInfo'
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
      await signInWithPopup(getClientAuth(), provider)
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
    await signOut(getClientAuth())
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
      <div className="space-y-3">
        <SettingsHeader />
        <AppearanceSection />
        <ProfileSection body={body} />

        {/* Signed out, the page still says where the data comes from and what
            signing in unlocks, instead of ending on a bare button. */}
        <section className="space-y-2">
          <SectionDivider as="h2" className="px-1">
            {t.settings.sections.data}
          </SectionDivider>
          <GlassSurface variant="card" className="rounded-card-sm px-4">
            <StaticRow
              title={t.settings.dataSource.garmin}
              sub={
                lastSyncedAt
                  ? t.settings.dataSource.readOnlySynced(formatRelativeAgo(lastSyncedAt), t.common.runs(activityCount))
                  : t.settings.dataSource.readOnly
              }
              trailing={lastSyncedAt && <span aria-hidden className="size-2 rounded-full bg-delta-good" />}
            />
            {/* The hub promises export, so the row is here signed out too; the
                workbook is owner-only, so it asks for the sign-in first. */}
            <button type="button" onClick={handleSignIn} className="block w-full border-t border-border text-left">
              <StaticRow
                title={t.settings.dataExport.title}
                sub={t.settings.dataExport.signedOut(t.common.runs(activityCount))}
                trailing={<ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden="true" />}
              />
            </button>
          </GlassSurface>
        </section>

        <section className="space-y-2">
          <SectionDivider as="h2" className="px-1">
            {t.settings.sections.account}
          </SectionDivider>
          <GlassSurface variant="card" className="rounded-card-sm px-4 pb-3.5">
            <StaticRow title={t.settings.notifications.title} sub={t.settings.auth.signInToManage} />
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 active:bg-accent/80 disabled:opacity-60"
            >
              {signingIn ? t.settings.auth.signingIn : t.settings.auth.signIn}
            </button>
          </GlassSurface>
        </section>

        <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
        <Toast toast={toast} leaving={leaving} />
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
        <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
        <p className="text-center text-sm text-muted-foreground">{t.settings.auth.accessDenied}</p>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
        >
          {t.settings.auth.switchAccount}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <SettingsHeader />
      <AppearanceSection />
      <ProfileSection body={body} />

      <section className="space-y-2">
        <SectionDivider as="h2" className="px-1">
          {t.settings.sections.data}
        </SectionDivider>
        <DataSourceInfo lastSyncedAt={lastSyncedAt} activityCount={activityCount} device={device} user={user} />
      </section>

      <section className="space-y-2">
        <SectionDivider as="h2" className="px-1">
          {t.settings.sections.account}
        </SectionDivider>
        <NotificationsForm />
        <button
          onClick={handleSignOut}
          className="glass-card h-11 w-full rounded-xl text-sm font-semibold text-muted-foreground transition-colors active:scale-[0.98]"
        >
          {t.settings.auth.signOut}
        </button>
      </section>

      <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}

function SettingsHeader() {
  return (
    <div>
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" />
      <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
    </div>
  )
}

/** The one setting that is the user's own: accent and theme. */
function AppearanceSection() {
  return (
    <section className="space-y-2">
      <SectionDivider as="h2" className="px-1">
        {t.settings.sections.appearance}
      </SectionDivider>
      <GlassSurface variant="card" className="rounded-card-sm p-4">
        <AccentPicker />
        <div className="my-3 h-px bg-foreground/[0.06]" />
        <ThemeSegmented />
      </GlassSurface>
    </section>
  )
}

/** Height, weight and BMI, as Garmin has them: read-only rows. */
function ProfileSection({ body }: { body?: Body }) {
  const rows = body ? bodyMetrics(body) : []
  if (rows.length === 0) return null
  return (
    <section className="space-y-2" data-testid="settings-profile">
      <SectionDivider as="h2" className="px-1">
        {t.settings.sections.profile}
      </SectionDivider>
      <GlassSurface variant="card" className="rounded-card-sm px-4">
        <dl>
          {rows.map((row) => (
            <div key={row.label} className="flex min-h-12 items-center justify-between gap-3 border-t border-border first:border-t-0">
              <dt className="text-body text-foreground">{row.label}</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {row.value}
                {row.unit && <span className="ml-1 text-footnote font-medium text-muted-foreground">{row.unit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </GlassSurface>
    </section>
  )
}

/** A read-only row in a settings card: title, status line, optional mark. */
function StaticRow({ title, sub, trailing }: { title: string; sub: string; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <div className="min-w-0">
        <p className="text-body font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      {trailing}
    </div>
  )
}
