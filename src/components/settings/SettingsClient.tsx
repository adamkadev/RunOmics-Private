'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { SIGN_IN_PATH, endSiteSession, replacePage } from '@/lib/siteSession'
import { formatRelativeAgo } from '@/lib/formatters'
import { t } from '@/i18n'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Toast, useToast } from '@/components/ui/Toast'
import { AccentPicker } from './AccentPicker'
import { ThemeSegmented } from './ThemeSegmented'
import { GlowRow } from './GlowRow'
import { DataSourceInfo, type SyncDevice } from './DataSourceInfo'
import { ConnectedMark, GarminTile } from './GarminMark'
import { NotificationsForm } from './NotificationsForm'
import { BuildInfo } from './BuildInfo'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'
import { bodyMetrics } from '@/components/profile/ProfileAthleteStats'
import { GARMIN_CONNECT_URL } from '@/lib/garminConnect'

interface Body {
  heightCm?: number
  weightKg?: number
}

/** The heart rates the Athlete & zones row names. */
interface Zones {
  lthrBpm?: number
  maxHrBpm?: number
}

interface Props {
  lastSyncedAt: string | null
  activityCount: number
  device?: SyncDevice
  /** Height and weight from Garmin: moved here from Athlete (C2, v4.4). */
  body?: Body
  zones?: Zones
}

export const ATHLETE_HREF = '/athlete'

export function SettingsClient({ lastSyncedAt, activityCount, device, body, zones }: Props) {
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
        <ProfileSection body={body} zones={zones} />

        {/* Signed out, the page still says where the data comes from and what
            signing in unlocks, instead of ending on a bare button. The sync
            is the owner's, so there is no Sync here. */}
        <Section title={t.settings.sections.data}>
          <div className={GROUP_CARD}>
            <div className="flex items-center gap-3 px-4 py-3" data-testid="garmin-row" data-row-thumb>
              <GarminTile />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{device?.name ?? t.settings.dataSource.garmin}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {lastSyncedAt && <ConnectedMark />}
                  {lastSyncedAt
                    ? t.settings.dataSource.readOnlySynced(formatRelativeAgo(lastSyncedAt), t.common.runs(activityCount))
                    : t.settings.dataSource.readOnly}
                </p>
              </div>
            </div>
            {/* The hub promises export, so the row is here signed out too; the
                workbook is owner-only, so it asks for the sign-in first. */}
            <button type="button" onClick={handleSignIn} className={`${GROUP_ROW} transition-colors hover:bg-[var(--surface-2)]`}>
              <span className="min-w-0 truncate text-sm text-foreground">{t.settings.dataExport.title}</span>
              <span className="shrink-0 text-sm font-medium text-accent-text">{t.settings.rowAction.signIn}</span>
            </button>
          </div>
        </Section>

        <Section title={t.settings.sections.notifications}>
          <div className={`${GROUP_CARD} flex flex-col gap-3.5 px-4 py-4`}>
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
      <ProfileSection body={body} zones={zones} />

      <Section title={t.settings.sections.data}>
        <DataSourceInfo lastSyncedAt={lastSyncedAt} activityCount={activityCount} device={device} user={user} />
      </Section>

      <Section title={t.settings.sections.notifications}>
        <NotificationsForm />
      </Section>

      {/* Sign out as red text, not a box (3.0 1i): it ends the session, and
          it is the page's last word before the build line. */}
      <button
        type="button"
        onClick={handleSignOut}
        className="mt-1.5 flex min-h-11 w-full items-center justify-center text-sm font-medium text-[var(--neg)] transition-opacity active:opacity-60"
      >
        {t.settings.auth.signOut}
      </button>

      <BuildInfo onCopied={() => showToast(t.settings.buildCopied, true)} />
      <Toast toast={toast} leaving={leaving} />
    </div>
  )
}

function SettingsHeader() {
  return (
    <header className="mb-1.5">
      {/* Settings is a sidebar row on a wide screen: the way back is on a phone only. */}
      <BackButton label={t.pages.settings.back} fallbackHref="/profile" className="lg:hidden" />
      <h1 className="text-display text-foreground">{t.pages.settings.title}</h1>
    </header>
  )
}

/** A group of settings: its eyebrow, then its card. */
function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <SectionDivider as="h2" className="px-1">
        {title}
      </SectionDivider>
      {children}
    </section>
  )
}

/**
 * The settings that are the user's own (v4.17; 3.0 1i): the theme on one
 * row, the background glow (round 2, F2) under it, then the accent
 * with its caption on the right and the swatches under them.
 */
function AppearanceSection() {
  const a = t.settings
  return (
    <Section title={a.sections.appearance}>
      <div className={GROUP_CARD} data-testid="settings-appearance">
        <div className={GROUP_ROW}>
          <p className="text-foreground">{a.appearance.themeLabel}</p>
          <ThemeSegmented />
        </div>
        <GlowRow className={GROUP_ROW} />
        <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[17px] tracking-[-0.027rem] text-foreground">{a.accent.title}</p>
            <p className="text-[13px] text-muted-foreground">{a.accent.caption}</p>
          </div>
          <AccentPicker />
        </div>
      </div>
    </Section>
  )
}

/** "LTHR 179 · Max 200", or whichever of the two Garmin has. */
export function zonesSummary(zones: Zones | undefined): string | null {
  const p = t.settings.profile
  const parts = [
    zones?.lthrBpm !== undefined ? p.lthr(zones.lthrBpm) : null,
    zones?.maxHrBpm !== undefined ? p.maxHr(zones.maxHrBpm) : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Height and weight, as Garmin has them (the eyebrow says so): read-only
 * rows, the value quiet on the right with no chevron. Then the one row that
 * goes somewhere, Athlete & zones, with the two heart rates its zones hang
 * from (3.0 1i). BMI is gone: it said nothing a runner acts on.
 */
function ProfileSection({ body, zones }: { body?: Body; zones?: Zones }) {
  const rows = body ? bodyMetrics(body) : []
  const summary = zonesSummary(zones)
  return (
    <Section title={t.settings.sections.profile} testId="settings-profile">
      <div className={GROUP_CARD}>
        {/* Each row the group's own child, a <dl> of one pair, so the
            group draws every separator the same way (F11). */}
        {rows.map((row) => (
          <dl key={row.label} className={`${GROUP_ROW} text-sm`}>
            <dt className="text-foreground">{row.label}</dt>
            <dd className="tabular-nums text-muted-foreground" data-testid="profile-value">
              {row.value}
              {row.unit && <span className="ml-1">{row.unit}</span>}
            </dd>
          </dl>
        ))}
        <Link href={ATHLETE_HREF} className={`${GROUP_ROW} text-sm transition-colors hover:bg-[var(--surface-2)]`} data-testid="athlete-zones-row">
          <span className="min-w-0 truncate text-foreground">{t.pages.athlete.title}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {summary && <span className="tabular-nums">{summary}</span>}
            <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />
          </span>
        </Link>
      </div>
      {/* Where they change, as a way there (design review, Oct 2026) - a
          13 pt muted footnote, as iOS's, not an accent link (F12). */}
      <a
        href={GARMIN_CONNECT_URL}
        target="_blank"
        rel="noreferrer"
        className="hit-44 self-start px-1 text-[13px] leading-[18px] text-muted-foreground transition-opacity hover:opacity-80"
        data-testid="profile-garmin-link"
      >
        {t.settings.profile.readOnly}
      </a>
    </Section>
  )
}
